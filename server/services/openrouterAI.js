const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');
const UsageLog = require('../models/UsageLog');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// OpenRouter model slugs — add more here as we adopt other models/providers.
const MODELS = {
  GEMINI_FLASH: 'google/gemini-2.5-flash',
  GEMINI_FLASH_LITE: 'google/gemini-2.5-flash-lite',
};

const getApiKey = () => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY missing');
  return key.trim();
};

// Build an OpenAI-style image content part from a base64 string (raw or already a data URI)
const buildImagePart = (base64Data, mediaType = 'image/jpeg') => {
  const dataUri = base64Data.startsWith('data:') ? base64Data : `data:${mediaType};base64,${base64Data}`;
  return { type: 'image_url', image_url: { url: dataUri } };
};

const buildTextPart = (text) => ({ type: 'text', text });

/**
 * Low-level chat completion call against OpenRouter.
 * `messages` must already be in OpenAI chat format: [{ role: 'user'|'assistant', content: string | Array<part> }]
 * Do NOT include a system message in `messages` — pass it via `system` instead.
 */
const chatCompletion = async ({
  model,
  system = '',
  messages = [],
  maxTokens = 2000,
  temperature = 0.4,
  feature = 'other',
  userId = null,
}) => {
  if (!model) throw new Error('OpenRouter request requires a model');

  const apiKey = getApiKey();
  const finalMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;

  console.log('🔄 [OpenRouterAI] Request | Model:', model, '| Feature:', feature);

  const startTime = Date.now();
  try {
    const resp = await axios.post(
      OPENROUTER_API_URL,
      {
        model,
        messages: finalMessages,
        max_tokens: maxTokens,
        temperature,
        reasoning: { max_tokens: 0 },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'https://takehealth.app',
          'X-Title': 'Take Health',
        },
        timeout: 120000,
      }
    );

    const text = resp.data?.choices?.[0]?.message?.content;
    const finishReason = resp.data?.choices?.[0]?.finish_reason;
    if (finishReason === 'length') {
      console.warn(`⚠️ [OpenRouterAI] Response hit max_tokens (${maxTokens}) and was truncated — consider raising maxTokens for this call.`);
    }
    if (!text) {
      console.error('❌ [OpenRouterAI] Empty response body:', JSON.stringify(resp.data).substring(0, 500));
      throw new Error('No content in OpenRouter response');
    }

    const usage = resp.data?.usage || {};
    UsageLog.create({
      userId,
      feature,
      model,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cacheReadTokens: usage.prompt_tokens_details?.cached_tokens || 0,
      cacheWriteTokens: 0,
      durationMs: Date.now() - startTime,
      status: 'success',
    }).catch((e) => console.error('UsageLog save failed:', e.message));

    return text;
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ [OpenRouterAI] API ERROR:', errorMsg);
    if (err.response?.data) {
      console.error('❌ [OpenRouterAI] Full API Error Data:', JSON.stringify(err.response.data));
    }

    UsageLog.create({
      userId,
      feature,
      model,
      durationMs: Date.now() - startTime,
      status: 'error',
      errorMessage: String(errorMsg).substring(0, 300),
    }).catch((e) => console.error('UsageLog save failed:', e.message));

    throw new Error(`OpenRouter request failed: ${errorMsg}`);
  }
};

// Extracts and parses the JSON object embedded in a model's text response.
const parseJsonResponse = (text) => {
  if (!text) throw new Error('Empty AI response from server');

  const start = text.indexOf('{');
  if (start === -1) {
    console.error('❌ [OpenRouterAI] No opening JSON marker found. RAW:', text.substring(0, 500));
    throw new Error('AI failed to return structured data. Please try again with more details.');
  }

  // If the response got cut off mid-generation (hit max_tokens), there may be no closing
  // brace at all — hand everything from the first '{' onward to robustJsonParse, which
  // knows how to close unbalanced brackets rather than failing outright.
  const end = text.lastIndexOf('}');
  const jsonStr = end > start ? text.substring(start, end + 1) : text.substring(start);

  const parsed = robustJsonParse(jsonStr);
  if (!parsed) throw new Error('JSON parser returned empty result');
  return parsed;
};

module.exports = {
  MODELS,
  chatCompletion,
  buildImagePart,
  buildTextPart,
  parseJsonResponse,
};
