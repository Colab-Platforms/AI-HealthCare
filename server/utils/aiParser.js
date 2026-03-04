/**
 * Utility to robustly parse JSON from AI responses
 * Handles common LLM errors like trailing commas, unquoted keys, and markdown decoration
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
            // If still failing, try a more aggressive repair for unquoted keys
            try {
                let moreRepaired = repaired
                    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Ensure keys are double-quoted
                    .replace(/:\s*'([^']*)'/g, ': "$1"'); // Convert single quoted values to double quoted
                return JSON.parse(moreRepaired);
            } catch (e3) {
                console.error('❌ JSON repair failed completely.');
                console.error('Problematic string start:', cleaned.substring(0, 100));
                throw new Error(`JSON Parse Error: ${e.message}`);
            }
        }
    }
};

module.exports = { robustJsonParse };
