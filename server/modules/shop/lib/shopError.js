// Typed error for the shop module. Controllers turn it into
// `{ code, message, ...details }` with the given HTTP status; anything else is a 500.
class ShopError extends Error {
    constructor(status, code, message, details = {}) {
        super(message);
        this.name = 'ShopError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

const sendError = (res, err, logTag) => {
    if (err instanceof ShopError) {
        return res.status(err.status).json({ code: err.code, message: err.message, ...err.details });
    }
    console.error(`[${logTag}]`, err.message);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
};

module.exports = { ShopError, sendError };
