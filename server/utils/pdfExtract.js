const path = require('path');
const { Worker } = require('worker_threads');

/**
 * Extract text from a PDF buffer without blocking the event loop.
 *
 * pdf-parse is CPU-bound and synchronous in its hot path — on a large report it
 * holds the main thread for seconds. On a shared-CPU host that stalls *every*
 * concurrent request, not just this one, which is why report uploads used to
 * make the whole API appear to hang. Running it on a worker thread keeps the
 * event loop free to serve traffic while the parse happens.
 *
 * Never throws: on any failure it resolves to '' so callers fall back to
 * AI vision/OCR, matching the previous inline behaviour.
 */
function extractPdfText(buffer, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve) => {
    if (!buffer || !buffer.length) return resolve('');

    let settled = false;
    let worker;

    const finish = (text) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (worker) worker.terminate().catch(() => {});
      resolve(text);
    };

    const timer = setTimeout(() => {
      console.warn('[pdfExtract] Timed out — falling back to AI vision/OCR');
      finish('');
    }, timeoutMs);

    try {
      worker = new Worker(path.join(__dirname, 'pdfExtract.worker.js'), {
        workerData: { buffer },
      });
    } catch (err) {
      console.warn('[pdfExtract] Could not start worker:', err.message);
      return finish('');
    }

    worker.on('message', (msg) => {
      if (msg?.error) console.warn('[pdfExtract] Parse failed, relying on AI vision/OCR:', msg.error);
      finish(msg?.text || '');
    });
    worker.on('error', (err) => {
      console.warn('[pdfExtract] Worker error:', err.message);
      finish('');
    });
    worker.on('exit', () => finish(''));
  });
}

module.exports = { extractPdfText };
