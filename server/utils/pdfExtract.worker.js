const { parentPort, workerData } = require('worker_threads');
const pdfParse = require('pdf-parse');

// Worker entry point — see utils/pdfExtract.js for why the parse runs off the
// main thread. Guarded so that requiring this file directly (a module sweep, a
// test runner collecting files) is a no-op instead of a crash.
if (parentPort && workerData?.buffer) {
  pdfParse(Buffer.from(workerData.buffer))
    .then(data => parentPort.postMessage({ text: data.text || '' }))
    .catch(err => parentPort.postMessage({ text: '', error: err.message }));
}
