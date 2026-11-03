const express = require('express');
const { publicShareLimiter } = require('../middleware/rateLimit');
const pub = require('../controllers/publicShareController');

// JSON + file access for a shared report. No auth: the unguessable token is the credential.
const api = express.Router();
api.use(publicShareLimiter);
api.get('/:token', pub.getShare);
api.get('/:token/file', pub.getShareFile);

// Human-facing page that the share link opens in any browser.
const viewer = express.Router();
viewer.use(publicShareLimiter);
viewer.get('/:token', pub.renderViewer);

module.exports = { api, viewer };
