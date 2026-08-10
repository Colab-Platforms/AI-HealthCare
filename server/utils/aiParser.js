/**
 * Utility to robustly parse JSON from AI responses.
 *
 * Handles markdown fences, surrounding prose, trailing commas, stray control
 * characters, and TRUNCATED responses (a response cut off mid-object).
 *
 * Every repair here is STRING-AWARE: it walks the text tracking whether the
 * cursor sits inside a JSON string literal, and only rewrites structure found
 * outside one. This matters because medical prose routinely contains the exact
 * characters a naive repair looks for — "Note: your HDL is low", "eat fruit,
 * vegetables}", "range: 13.5-17.5". An earlier version applied regexes blindly
 * and could turn `"explanation": "Note: your HDL is low"` into malformed or,
 * worse, valid-but-wrong JSON.
 */

/**
 * Single pass over `str`, tracking string/escape state.
 *
 * @returns {object} stack          - unclosed `{`/`[` in order of opening
 *                   inString       - true if the text ends inside a string
 *                   stringStart    - index of that unterminated string's quote
 *                   trailingCommas - indices of commas that precede `}`/`]` or EOF
 *                   commas         - indices of every comma outside a string
 */
const scanStructure = (str) => {
  const stack = [];
  const trailingCommas = [];
  const commas = [];
  let inString = false;
  let escaped = false;
  let stringStart = -1;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = false; stringStart = -1; }
      continue;
    }

    if (ch === '"') { inString = true; stringStart = i; continue; }
    if (ch === '{' || ch === '[') { stack.push({ ch, index: i }); continue; }
    if (ch === '}' || ch === ']') { stack.pop(); continue; }

    if (ch === ',') {
      commas.push(i);
      let j = i + 1;
      while (j < str.length && /\s/.test(str[j])) j++;
      if (j >= str.length || str[j] === '}' || str[j] === ']') trailingCommas.push(i);
    }
  }

  return { stack, inString, stringStart, trailingCommas, commas };
};

const removeIndices = (str, indices) => {
  if (!indices.length) return str;
  const drop = new Set(indices);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    if (!drop.has(i)) out += str[i];
  }
  return out;
};

/**
 * Strip control characters that appear OUTSIDE string literals, and escape the
 * ones that appear inside (a raw newline inside a JSON string is invalid, but
 * the text is still wanted — so escape it rather than destroy it).
 */
const sanitizeControlChars = (str) => {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = ch.charCodeAt(0);
    const isControl = (code <= 0x1f) || code === 0x7f;

    if (inString) {
      if (escaped) { escaped = false; out += ch; continue; }
      if (ch === '\\') { escaped = true; out += ch; continue; }
      if (ch === '"') { inString = false; out += ch; continue; }
      if (isControl) {
        if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else out += ' ';
        continue;
      }
      out += ch;
      continue;
    }

    if (ch === '"') { inString = true; out += ch; continue; }
    out += isControl ? ' ' : ch;
  }

  return out;
};

/** Index of the last comma outside a string, or -1. */
const lastStructuralComma = (str) => {
  const { commas } = scanStructure(str);
  return commas.length ? commas[commas.length - 1] : -1;
};

/**
 * Repair a response that was cut off mid-generation:
 *   1. discard an unterminated trailing string (and the dangling key it belongs to)
 *   2. drop trailing commas / a dangling `"key":` with no value
 *   3. close every still-open bracket and brace
 *   4. if it still won't parse, drop the last member and retry
 */
function repairTruncatedJson(str) {
  let work = str;

  // 1. Unterminated string → cut back to its opening quote, then remove the
  //    `"key":` prefix it belonged to so we don't leave a key with no value.
  const initial = scanStructure(work);
  if (initial.inString && initial.stringStart >= 0) {
    work = work.slice(0, initial.stringStart);
    work = work.replace(/[\s,]*"(?:[^"\\]|\\.)*"\s*:\s*$/, '');
  } else {
    // A bare token at the very end may itself have been cut mid-token, and
    // unlike a broken string it still PARSES — as a different value.
    // `"healthScore": 68` cut to `"healthScore": 6` yields 6; a haemoglobin of
    // `13.1` cut to `13` or `1` is a clinically dangerous silent error.
    //
    // We cannot tell a complete trailing token from a truncated one, so we drop
    // it. Losing one field beats reporting a wrong lab value.
    work = work.replace(/([:,[{])\s*(?:-?[0-9][^,{}[\]"\s]*|[A-Za-z]+)\s*$/, '$1');
  }

  for (let attempt = 0; attempt < 200; attempt++) {
    // 2. Trailing commas and a dangling key with no value.
    let candidate = removeIndices(work, scanStructure(work).trailingCommas);
    candidate = candidate.replace(/[\s,]+$/, '');
    if (/:\s*$/.test(candidate)) {
      candidate = candidate.replace(/[\s,]*"(?:[^"\\]|\\.)*"\s*:\s*$/, '').replace(/[\s,]+$/, '');
    }
    candidate = removeIndices(candidate, scanStructure(candidate).trailingCommas);

    // 3. Close what is still open, innermost first.
    const { stack } = scanStructure(candidate);
    let suffix = '';
    for (let i = stack.length - 1; i >= 0; i--) suffix += stack[i].ch === '{' ? '}' : ']';

    try {
      const result = JSON.parse(candidate + suffix);
      console.log(`✅ Truncated JSON recovery successful (dropped ${attempt} incomplete member(s)).`);
      return result;
    } catch (e) {
      // 4. Still broken — the tail holds a half-written value (`12.`, `tru`).
      //    Drop the last member and try again.
      const cut = lastStructuralComma(candidate);
      if (cut < 0) throw e;
      work = candidate.slice(0, cut);
    }
  }

  throw new Error('Unable to repair truncated JSON');
}

const robustJsonParse = (str) => {
  if (!str) return null;

  // Strip markdown code fences if present.
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  // Isolate the JSON object if the model wrapped it in prose.
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  } else if (startIdx !== -1) {
    // No closing brace at all — truncated. Keep from the first `{` so the
    // truncation repair below has something to work with.
    cleaned = cleaned.substring(startIdx);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('⚠️ Standard JSON.parse failed, attempting to repair JSON...');

    // Tier 1: control characters + trailing commas, both string-aware.
    const sanitized = sanitizeControlChars(cleaned);
    const repaired = removeIndices(sanitized, scanStructure(sanitized).trailingCommas);

    try {
      return JSON.parse(repaired);
    } catch (e2) {
      // Tier 2: assume truncation.
      //
      // NOTE: there is deliberately no "quote the unquoted keys" tier here.
      // That repair (`/([a-zA-Z0-9_]+):/g` → `"$1":`) rewrote any `word:`
      // sequence anywhere in the document, including inside prose values, and
      // silently corrupted real analysis text. Claude does not emit unquoted
      // keys when the prompt specifies a JSON structure, so the tier cost far
      // more than it bought.
      console.warn('⚠️ Attempting truncated JSON recovery...');
      try {
        return repairTruncatedJson(repaired);
      } catch (e3) {
        console.error('❌ JSON repair failed completely.');
        console.error('Problematic string start:', cleaned.substring(0, 200));
        throw new Error(`JSON Parse Error: ${e.message}`);
      }
    }
  }
};

module.exports = { robustJsonParse };
