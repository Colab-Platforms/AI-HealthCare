const path = require('path');
const express = require('express');
const { publicShareLimiter } = require('../middleware/rateLimit');
const pub = require('../controllers/publicShareController');

// JSON + file access for a shared report. No auth: the unguessable token is the credential.
const api = express.Router();

// Viewer script + self-hosted PDF.js. Registered before the limiter and /:token
// so static files are not counted against the per-IP limit.
api.use('/_assets', express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '7d',
  setHeaders: (res, file) => {
    if (file.endsWith('.mjs')) res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

api.use(publicShareLimiter);
api.get('/:token', pub.getShare);
api.get('/:token/file', pub.getShareFile);

// Human-facing page that the share link opens in any browser.
const viewer = express.Router();
viewer.use(publicShareLimiter);
viewer.get('/:token', pub.renderViewer);

module.exports = { api, viewer };
