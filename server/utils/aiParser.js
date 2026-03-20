/**
 * Utility to robustly parse JSON from AI responses
 * Handles common LLM errors like trailing commas, unquoted keys, markdown decoration,
 * and TRUNCATED responses (the most common issue on Vercel)
 */
const robustJsonParse = (str) => {
    if (!str) return null;

    // Clean potential markdown code blocks if they exist
    let cleaned = str.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Find the first { and last } to isolate the JSON object if there's surrounding text
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleaned = cleaned.substring(startIdx, endIdx + 1);
    }

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.warn('⚠️ Standard JSON.parse failed, attempting to repair JSON...');

        // Fix common LLM JSON errors:
        // 1. Remove trailing commas in objects and arrays
        // 2. Remove non-printable control characters
        let repaired = cleaned
            .replace(/,\s*([\]}])/g, '$1')
            .replace(/[\x00-\x1F\x7F]/g, ' ');

        try {
            return JSON.parse(repaired);
        } catch (e2) {
            // Try more aggressive repair for unquoted keys
            try {
                let moreRepaired = repaired
                    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Ensure keys are double-quoted
                    .replace(/:\s*'([^']*)'/g, ': "$1"'); // Convert single quoted values to double quoted
                return JSON.parse(moreRepaired);
            } catch (e3) {
                // LAST RESORT: Try to salvage truncated JSON by closing open brackets
                console.warn('⚠️ Attempting truncated JSON recovery...');
                try {
                    return repairTruncatedJson(repaired);
                } catch (e4) {
                    console.error('❌ JSON repair failed completely.');
                    console.error('Problematic string start:', cleaned.substring(0, 100));
                    throw new Error(`JSON Parse Error: ${e.message}`);
                }
            }
        }
    }
};

/**
 * Attempts to repair truncated JSON by:
 * 1. Removing the last incomplete key-value pair
 * 2. Closing all open brackets and braces
 */
function repairTruncatedJson(str) {
    // Remove any trailing incomplete string value (e.g. `"key": "some text that was cu`)
    // Find the last complete key-value pair
    let truncated = str;

    // Remove trailing content after the last complete value
    // Strategy: find last valid terminator (, or ] or } or number or true/false/null or ")
    // and chop everything after any dangling content

    // Step 1: Remove any incomplete string at the end (unmatched quote)
    const quoteCount = (truncated.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
        // Odd number of quotes means an unclosed string — remove from last quote onwards
        const lastQuoteIdx = truncated.lastIndexOf('"');
        // Find the start of this dangling key-value
        const lastCommaOrBrace = Math.max(
            truncated.lastIndexOf(',', lastQuoteIdx),
            truncated.lastIndexOf('{', lastQuoteIdx),
            truncated.lastIndexOf('[', lastQuoteIdx)
        );
        if (lastCommaOrBrace > 0) {
            truncated = truncated.substring(0, lastCommaOrBrace);
            // If we cut at a comma, that comma is now trailing — it'll be cleaned below
        }
    }

    // Step 2: Remove trailing commas
    truncated = truncated.replace(/,\s*$/, '');

    // Step 3: Count open vs close brackets and braces, then close them
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < truncated.length; i++) {
        const ch = truncated[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') openBraces++;
        if (ch === '}') openBraces--;
        if (ch === '[') openBrackets++;
        if (ch === ']') openBrackets--;
    }

    // Close any remaining open brackets/braces
    // Close arrays first (inner), then objects (outer)
    let suffix = '';
    for (let i = 0; i < openBrackets; i++) suffix += ']';
    for (let i = 0; i < openBraces; i++) suffix += '}';

    const finalJson = truncated + suffix;

    // Final cleanup: remove trailing commas before closing brackets
    const finalCleaned = finalJson
        .replace(/,\s*([\]}])/g, '$1');

    const result = JSON.parse(finalCleaned);
    console.log('✅ Truncated JSON recovery successful!');
    return result;
}

module.exports = { robustJsonParse };
