// Public shop routes (catalog) don't require login, but if the app sends its
// Bearer token we note who it is — only for the event log. No DB lookup, and
// an invalid / expired token is simply ignored (the request stays anonymous).

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const h = req.headers.authorization || '';
    if (h.startsWith('Bearer ') && process.env.JWT_SECRET) {
        try {
            const decoded = jwt.verify(h.slice(7), process.env.JWT_SECRET);
            if (decoded?.id) req.shopUserId = String(decoded.id);
        } catch { /* anonymous */ }
    }
    next();
};
