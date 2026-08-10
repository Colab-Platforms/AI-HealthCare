const { Receiver } = require('@upstash/qstash');

let receiver;

function getReceiver() {
  if (receiver !== undefined) return receiver;
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  receiver = current
    ? new Receiver({ currentSigningKey: current, nextSigningKey: next })
    : null;
  return receiver;
}

/**
 * Verify that a background-job webhook genuinely came from Upstash QStash.
 *
 * These endpoints take userId/reportId straight from the request body and spend
 * AI credits, so without this anyone who knows the URL can trigger arbitrary
 * processing against any user's records. Signature verification is the only
 * thing standing in front of them — they are intentionally not behind `protect`,
 * because QStash calls them with no user session.
 *
 * Requires express.json's `verify` hook to have populated req.rawBody: the
 * signature covers the exact bytes sent, and re-serialising req.body would not
 * reproduce them.
 */
const verifyQStash = async (req, res, next) => {
  const r = getReceiver();

  // Fail closed. An unverifiable webhook endpoint is worse than a broken one.
  if (!r) {
    console.error('[QStash] QSTASH_CURRENT_SIGNING_KEY not set — rejecting webhook');
    return res.status(503).json({ message: 'Webhook verification unavailable' });
  }

  const signature = req.headers['upstash-signature'];
  if (!signature) {
    return res.status(401).json({ message: 'Missing QStash signature' });
  }

  try {
    await r.verify({ signature, body: req.rawBody ?? '' });
    return next();
  } catch (err) {
    console.error('[QStash] Signature verification failed:', err.message);
    return res.status(401).json({ message: 'Invalid QStash signature' });
  }
};

module.exports = { verifyQStash };
