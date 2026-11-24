// AI Coach V2 settings. One place for models, effort and time limits so the
// speed / cost trade-offs are tuned here, not scattered across the graph.

const isEnabled = () => process.env.AI_COACH_V2 === 'true';

module.exports = {
    isEnabled,

    // Haiku 5.5: classify + fact extraction (one call). Sonnet 5.5: the answer.
    // Neither model accepts `temperature`; thinking depth is `effort`.
    MODELS: {
        classifier: 'claude-haiku-5-5',
        responder: 'claude-sonnet-5-5',
    },
    EFFORT: {
        classifier: 'low',
        responder: 'low',
    },
    MAX_TOKENS: {
        classifier: 1024,
        responder: 2000, // reply length is set by the prompt; this is only the ceiling
    },

    // Sonnet 5.5 can't take thinking "disabled"; "between_tools" turns thinking
    // off when no tools are used (our case) -> fastest first token. Switch to
    // { type: 'adaptive' } if answers need more reasoning (measure first).
    RESPONDER_THINKING: { type: 'between_tools' },

    // Server-side fallback if Sonnet 5.5 declines a request (beta).
    RESPONDER_FALLBACK: { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' },

    // Time limits (ms). A slow step degrades the answer, never blocks it.
    TIMEOUTS: {
        classifier: 4000,    // fall back to keyword routing after this
        specialist: 2500,    // each specialist; a late one is reported as "data unavailable"
    },

    // How long a skipped coach question stays quiet before it may be asked again.
    GAP_SNOOZE_DAYS: 7,

    // Conversation turns sent to the models (each turn = user + assistant).
    HISTORY_TURNS: 6,
};
