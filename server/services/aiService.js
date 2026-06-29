const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');
const UsageLog = require('../models/UsageLog');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_HAIKU_MODEL = 'claude-4-haiku-latest';
const FALLBACK_HAIKU_MODEL = 'claude-3-5-haiku-latest';

exports.CLAUDE_MODEL = CLAUDE_MODEL;
exports.CLAUDE_HAIKU_MODEL = CLAUDE_HAIKU_MODEL;

// Save usage log — fire-and-forget, never blocks the main response
const saveUsageLog = (data) => {
  UsageLog.create(data).catch(err =>
    console.error('UsageLog save failed:', err.message)
  );
};

const makeAnthropicRequest = async (messages, maxTokens = 4096, modelOverride = null, context = {}) => {
  const selectedModel = modelOverride || CLAUDE_MODEL;
  const startTime = Date.now();

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log(`🔄 Anthropic | Model: ${selectedModel} | MaxTokens: ${maxTokens} | Feature: ${context.feature || 'unknown'}`);

    let systemMessage = '';
    const filteredMessages = messages.filter(m => {
      if (m.role === 'system') { systemMessage = m.content; return false; }
      return true;
    });

    const requestTimeout = (process.env.VERCEL || process.env.VERCEL_ID) ? 280000 : 150000;

    const response = await axios.post(
      ANTHROPIC_API_URL,
      {
        model: selectedModel,
        system: systemMessage ? [{ type: 'text', text: systemMessage, cache_control: { type: 'ephemeral' } }] : undefined,
        messages: filteredMessages,
        max_tokens: maxTokens || 4000,
        temperature: 0
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
          'Content-Type': 'application/json',
          'Connection': 'close'
        },
        timeout: requestTimeout
      }
    );

    const usage = response.data?.usage || {};
    const durationMs = Date.now() - startTime;

    console.log(`✅ Anthropic | in:${usage.input_tokens} out:${usage.output_tokens} cache_read:${usage.cache_read_input_tokens || 0} | ${durationMs}ms`);

    // Log usage async — don't await
    saveUsageLog({
      userId:           context.userId   || null,
      feature:          context.feature  || 'other',
      reportId:         context.reportId || null,
      model:            selectedModel,
      inputTokens:      usage.input_tokens              || 0,
      outputTokens:     usage.output_tokens             || 0,
      cacheReadTokens:  usage.cache_read_input_tokens   || 0,
      cacheWriteTokens: usage.cache_creation_input_tokens || 0,
      durationMs,
      status: 'success',
    });

    if (response.data?.content?.[0]) return response.data.content[0].text;
    throw new Error('Invalid response');

  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    const modelMissing = /model/i.test(errorMsg);

    // Retry with fallback model
    if (modelMissing && selectedModel === CLAUDE_HAIKU_MODEL) {
      console.warn(`⚠️ Model unavailable (${selectedModel}). Retrying with ${FALLBACK_HAIKU_MODEL}...`);
      return makeAnthropicRequest(messages, maxTokens, FALLBACK_HAIKU_MODEL, context);
    }
    if (modelMissing && selectedModel === FALLBACK_HAIKU_MODEL) {
      console.warn(`⚠️ Model unavailable (${selectedModel}). Retrying with ${CLAUDE_MODEL}...`);
      return makeAnthropicRequest(messages, maxTokens, CLAUDE_MODEL, context);
    }

    // Log failed call
    saveUsageLog({
      userId:    context.userId  || null,
      feature:   context.feature || 'other',
      reportId:  context.reportId || null,
      model:     selectedModel,
      durationMs: Date.now() - startTime,
      status:    'error',
      errorMessage: errorMsg.substring(0, 300),
    });

    console.error('❌ Anthropic Error:', errorMsg);
    throw new Error(`AI Analysis Failed: ${errorMsg}`);
  }
};

exports.makeAnthropicRequest = makeAnthropicRequest;

const HEALTH_ANALYSIS_PROMPT = `Analyze this health report as an expert medical AI. You MUST extract EVERY SINGLE health marker, lab result, and medical observation found in the report text without exception.
STRUCTURE:
{
  "patientName": "Name",
  "reportDate": "YYYY-MM-DD",
  "documentCategory": "lab_report",
  "documentType": "Blood Test",
  "healthScore": 75,
  "summary": "Short 3-5 bullet points (•).",
  "doctorSummary": "A detailed 200-300 word professional doctor's note written in a warm, empathetic but medically authoritative tone — as if a senior physician is sitting across from the patient and explaining their results face-to-face. Use paragraph breaks for readability. Use **Markdown bolding** for any specific bio-markers or critical values mentioned. The doctor should: (1) Start by acknowledging the patient by name (if known) and greeting warmly, (2) Highlight what looks GOOD first to reassure the patient, (3) Then gently explain areas of concern with clear context — avoid scary medical jargon, use simple analogies where helpful (e.g. 'Your HDL is like a vacuum cleaner for your heart'), (4) Explain WHY certain values matter in plain language, (5) Give 2-3 specific, actionable lifestyle recommendations, (6) End with encouragement. Write in second person ('your', 'you'). Do NOT use bullet points — write flowing, conversational paragraphs. Make the patient feel understood, supported, and professionaly cared for.",
  "doctorAdvice": ["Specific advice 1 with reason", "Specific advice 2 with reason", "Specific advice 3 with reason"],
  "summaryPoints": ["Brief findings"],
  "keyFindings": ["finding1"],
  "metrics": {
    "MetricName": {
      "value": 14.2, 
      "unit": "unit", 
      "status": "normal/high/low", 
      "normalRange": "range",
      "whatIsThis": "1-line definition of this marker",
      "whatItDoes": "Detailed role this marker plays in the body",
      "lowHighImpact": "What it means when this value is low or high for health",
      "topFoods": ["Food1", "Food2", "Food3"],
      "symptoms": ["Symptom1", "Symptom2"]
    }
  },
  "deficiencies": [{"name": "Vit D", "severity": "mild/moderate/severe", "currentValue": "value", "normalRange": "range", "explanation": "Why this matters in simple terms"}],
  "recommendations": {"immediate": [], "lifestyle": []},
  "doctorConsultation": {"recommended": true, "urgency": "low", "specializations": ["Specialist"]}
}
CRITICAL: Extraction is your priority. Scan the entire report text and populate the "metrics" object with ALL found markers. For EACH metric, you MUST fill in whatIsThis, whatItDoes, lowHighImpact, topFoods, and symptoms.
IMPORTANT: Deficiency "severity" MUST be one of: "mild", "moderate", "severe".
IMPORTANT: The "doctorSummary" MUST be written like a real doctor talking to the patient. Do NOT write bullet points — write flowing, conversational paragraphs with Markdown bolding for emphasis. Be warm, professional, and thorough.
IMPORTANT: The "doctorAdvice" array MUST consist of 3-5 specific, actionable points derived directly from the user's specific bio-marker results. Include the "why" for each advice based on their clinical data. Avoid generic advice.
IMPORTANT: "documentCategory" MUST be exactly one of: "lab_report", "prescription", "scan", "doctor_notes", "vaccination", "insurance", "other". Detect from content: lab values/blood tests = "lab_report", medicines/drugs prescribed = "prescription", X-Ray/MRI/CT/Ultrasound/imaging = "scan", doctor consultation notes/discharge summary = "doctor_notes", vaccine records = "vaccination", insurance/ID documents = "insurance".
IMPORTANT: "documentType" is a short human-readable label like "Blood Test", "Prescription", "X-Ray", "MRI", "Ultrasound", "CBC Report", "Lipid Profile", "Thyroid Panel", "Discharge Summary", "Vaccination Record" etc. Detect from actual report content.`;

const MEDICAL_REPORT_VALIDATOR_PROMPT = `You are a strict gatekeeper for a healthcare app.
Task: Decide if the uploaded content is a REAL medical/healthcare report/document (examples: lab test report, radiology report, prescription, discharge summary, clinical notes, pathology report, etc).

Rules:
- If it is NOT a medical/healthcare report, respond with JSON ONLY:
  {"isMedical": false, "detected": "<what this document most likely is>", "message": "This file does not contains any medical report please upload correct medical report for analyze. It looks like: <what this document most likely is>."}
- If it IS a medical/healthcare report, respond with JSON ONLY:
  {"isMedical": true}

Be conservative: only return true when you're confident it's a medical/healthcare document. Do not include any extra keys, text, or explanation outside JSON.`;

const validateMedicalReport = async (reportText, fileData = null) => {
  try {
    const userContent = [];

    // For PDFs: use extracted text only (no need to send full PDF for validation)
    // For images: send the image since there may be no extracted text
    if (fileData && fileData.buffer && fileData.mimetype?.startsWith('image/')) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: fileData.mimetype,
          data: fileData.buffer.toString('base64')
        }
      });
    } else if (reportText && reportText.trim()) {
      // Cap at 3000 chars — enough to identify if it's a medical report
      userContent.push({ type: 'text', text: `Extracted Text:\n${reportText.substring(0, 3000)}` });
    }

    const messages = [
      { role: 'system', content: MEDICAL_REPORT_VALIDATOR_PROMPT },
      { role: 'user', content: userContent.length ? userContent : [{ type: 'text', text: 'No extracted text provided.' }] }
    ];

    const content = await makeAnthropicRequest(messages, 400, CLAUDE_HAIKU_MODEL, { feature: 'validate_report' });
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { isMedical: true };
    const parsed = robustJsonParse(jsonMatch[0]);
    if (typeof parsed?.isMedical === 'boolean') return parsed;
    return { isMedical: true };
  } catch (e) {
    return {
      isMedical: false,
      message: 'Unable to validate this upload as a medical report right now. Please re-upload a clear medical report (lab, prescription, radiology, or discharge summary).'
    };
  }
};
exports.validateMedicalReport = validateMedicalReport;

exports.analyzeHealthReport = async (reportText, user = {}, fileData = null, reportType = 'general', context = {}) => {
  try {
    let userContext = `User: ${user.name || 'Patient'}. Type: ${reportType}`;
    const userContent = [];
    const hasPdf = fileData?.buffer && fileData?.mimetype === 'application/pdf';
    const hasImage = fileData?.buffer && fileData?.mimetype?.startsWith('image/');

    // Always include context; only include extracted text if there's no file (text-only fallback)
    if (!hasPdf && !hasImage && reportText && reportText.trim()) {
      userContent.push({ type: 'text', text: `${userContext}\n\nExtracted Text:\n${reportText.substring(0, 50000)}` });
    } else {
      userContent.push({ type: 'text', text: userContext });
    }

    if (hasPdf) {
      // Send PDF directly — Claude reads it natively, no need to also send extracted text
      userContent.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: fileData.buffer.toString('base64')
        }
      });
    } else if (hasImage) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: fileData.mimetype,
          data: fileData.buffer.toString('base64')
        }
      });
    }

    const validation = await validateMedicalReport(reportText, fileData);
    if (validation && validation.isMedical === false) {
      throw new Error(
        validation.message ||
          'This file does not contains any medical report please upload correct medical report for analyze.'
      );
    }

    const messages = [{ role: 'system', content: HEALTH_ANALYSIS_PROMPT }, { role: 'user', content: userContent }];
    const content = await makeAnthropicRequest(messages, 8000, null, {
      feature: context.feature || 'analyze_report',
      userId: user?._id || context.userId || null,
      reportId: context.reportId || null,
    });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        'Unable to read this as a structured medical report. Please upload a clear medical report (lab, prescription, radiology, or discharge summary).'
      );
    }
    return robustJsonParse(jsonMatch[0]);
  } catch (error) {
    throw error;
  }
};

exports.compareReports = async (currentReport, previousReport, context = {}) => {
  try {
    const prompt = `Compare: ${JSON.stringify(currentReport.aiAnalysis?.metrics)} and ${JSON.stringify(previousReport.aiAnalysis?.metrics)}. Return JSON {"overallTrend": "improving/declining"}`;
    const content = await makeAnthropicRequest([{ role: 'user', content: prompt }], 1000, CLAUDE_HAIKU_MODEL, { feature: 'compare_reports', ...context });
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? robustJsonParse(jsonMatch[0]) : { overallTrend: 'stable' };
  } catch (e) { return { overallTrend: 'unknown' }; }
};

// Build structured metric context for citation-aware prompting
const buildReportContext = (report) => {
  const metrics = report.aiAnalysis?.metrics || {};
  const metricLines = Object.entries(metrics).map(([name, m]) => {
    const val   = m?.value   ?? m?.result ?? '?';
    const unit  = m?.unit    ?? '';
    const range = m?.normalRange ?? 'N/A';
    const status = m?.status ?? 'unknown';
    return `  - [[metric:${name}]] ${name}: ${val} ${unit} (Normal: ${range}) — ${status}`;
  }).join('\n');

  const reportMeta = [
    `Report ID: [[report:${report._id}]]`,
    `Type: ${report.reportType || 'Lab Report'}`,
    `Date: ${report.reportDate ? new Date(report.reportDate).toDateString() : 'Unknown'}`,
    `Health Score: ${report.aiAnalysis?.healthScore ?? 'N/A'}/100`,
  ].join(' | ');

  return { metricLines, reportMeta, metricCount: Object.keys(metrics).length };
};

// Parse [[metric:Name]] and [[report:id]] citations from AI response
const parseCitations = (text, report) => {
  const sources = [];
  const metrics = report.aiAnalysis?.metrics || {};
  const seen = new Set();

  const metricMatches = [...text.matchAll(/\[\[metric:([^\]]+)\]\]/g)];
  metricMatches.forEach(([, name]) => {
    if (seen.has(`metric:${name}`)) return;
    seen.add(`metric:${name}`);
    const m = metrics[name] || Object.entries(metrics).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
    sources.push({
      type:   'metric',
      id:     name,
      label:  name,
      value:  m ? `${m.value ?? m.result ?? ''} ${m.unit ?? ''}`.trim() : null,
      range:  m?.normalRange ?? null,
      status: m?.status ?? null,
      reportId: String(report._id),
    });
  });

  const reportMatches = [...text.matchAll(/\[\[report:([^\]]+)\]\]/g)];
  reportMatches.forEach(([, id]) => {
    if (seen.has(`report:${id}`)) return;
    seen.add(`report:${id}`);
    sources.push({
      type:  'report',
      id,
      label: `${report.reportType || 'Report'} — ${report.reportDate ? new Date(report.reportDate).toDateString() : ''}`,
      reportId: String(report._id),
    });
  });

  // Clean tags from visible text
  const cleanText = text.replace(/\[\[(?:metric|report):[^\]]+\]\]/g, (match) => {
    const name = match.replace(/\[\[(?:metric|report):/, '').replace(']]', '');
    return `**${name}**`;
  });

  return { cleanText, sources };
};

exports.chatWithReport = async (report, message, chatHistory, context = {}) => {
  try {
    const { metricLines, reportMeta, metricCount } = buildReportContext(report);

    const systemPrompt = `You are a medical AI assistant. Answer questions ONLY based on the patient's actual report data below. Never fabricate values.

REPORT CONTEXT:
${reportMeta}

METRICS (${metricCount} found):
${metricLines || '  (No metrics extracted)'}

SUMMARY: ${report.aiAnalysis?.summary || 'Not available'}

CITATION RULES — MANDATORY:
- When you mention any metric value, tag it: [[metric:MetricName]]
- When referencing this report overall, tag it: [[report:${report._id}]]
- Example: "Your [[metric:Hemoglobin]] is 9.2 g/dL which is below normal range."
- Always cite — never state a health value without its [[metric:...]] tag
- Keep answers concise, empathetic, and in simple language`;

    const rawResponse = await makeAnthropicRequest(
      [{ role: 'system', content: systemPrompt }, ...chatHistory.slice(-6), { role: 'user', content: message }],
      1000, CLAUDE_HAIKU_MODEL, { feature: 'chat_about_report', ...context }
    );

    return parseCitations(rawResponse, report);
  } catch (e) {
    console.error('chatWithReport error:', e.message);
    return { cleanText: "I'm having trouble analyzing right now. Please try again.", sources: [] };
  }
};

exports.generateMetricInfo = async (metricName, metricValue, normalRange, unit, context = {}) => {
  try {
    const prompt = `Provide a professional medical explanation for the health metric "${metricName}" with a current value of ${metricValue} ${unit} (Normal Range: ${normalRange}).

    Return ONLY a JSON object with this structure:
    {
      "en": {
        "whatIsIt": "A concise 1-sentence medical definition.",
        "whatItDoes": "Detailed explanation of its physiological role.",
        "significance": "What the current status (${metricValue} ${unit}) specifically means for health.",
        "dietaryTips": ["Food 1", "Food 2", "Food 3"],
        "symptoms": ["Symptom 1", "Symptom 2"],
        "actions": ["Action 1", "Action 2"]
      }
    }`;

    const content = await makeAnthropicRequest([{ role: 'user', content: prompt }], 1200, CLAUDE_HAIKU_MODEL, { feature: 'metric_info', ...context });
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? robustJsonParse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('generateMetricInfo error:', e);
    return null;
  }
};

exports.generateVitalsInsights = async (metricType, history, user, context = {}) => {
  try {
    const prompt = `Insights for ${metricType}: ${JSON.stringify(history)}. JSON {"analysis": ""}`;
    const content = await makeAnthropicRequest([{ role: 'user', content: prompt }], 800, CLAUDE_HAIKU_MODEL, { feature: 'vitals_insights', userId: user?._id, ...context });
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? robustJsonParse(jsonMatch[0]) : null;
  } catch (e) { return null; }
};

exports.generateHealthDNA = async (userData, metricsSummary, recentTrends) => {
  try {
    const prompt = `Create a "Complete Health DNA Profile" for ${userData.name}.
    Context:
    - User Profile: ${JSON.stringify(userData)}
    - Aggregated Lab Metrics: ${JSON.stringify(metricsSummary)}
    - Recent Vitals Trends: ${JSON.stringify(recentTrends)}

    Return ONLY a JSON object with this structure:
    {
      "personality": {
        "title": "Short catchy title (e.g. The Balanced Athlete)",
        "motto": "A health motto",
        "description": "2-3 sentences describing their current health state/archetype"
      },
      "organHealth": [
        { "organ": "Heart", "score": 85, "status": "Optimal", "detail": "Detail based on BP/Heart rate" },
        { "organ": "Kidneys", "score": 75, "status": "Good", "detail": "Detail based on Urea/Creatinine" },
        { "organ": "Metabolism", "score": 60, "status": "Needs Focus", "detail": "Detail based on Glucose/A1c" }
      ],
      "riskAssessment": [
        { "hazard": "Diabetes", "riskLevel": "Moderate", "trend": "Increasing", "prevention": "Top advice" }
      ],
      "nutritionalGaps": {
        "critical": ["Vitamin D"],
        "optimal": ["Iron"],
        "advice": "Summary dietary advice"
      },
      "healthStory": "A long-form, 200-word personalized narrative of their health journey based on all data. Mention improvements or areas of regression."
    }`;
    
    const content = await makeAnthropicRequest([{ role: 'user', content: prompt }], 2500, CLAUDE_MODEL, {
      feature: 'health_dna',
    });
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? robustJsonParse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('generateHealthDNA error:', e);
    return null;
  }
};

