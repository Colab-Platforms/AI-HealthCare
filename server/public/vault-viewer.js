// Renders a shared vault report inside the public viewer page (/r/:token).
//
// PDFs are drawn onto canvases with PDF.js instead of an <iframe>: Chrome on
// Android has no built-in PDF viewer, so a PDF in an iframe is treated as a
// blocked download ("This content is blocked"). Everything is served from our
// own origin — no CDN.
import * as pdfjsLib from './pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const root = document.getElementById('viewer');
const { kind, src } = root.dataset;

const showMessage = (text) => {
  root.replaceChildren();
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = text;
  root.appendChild(p);
};

const renderPdf = async () => {
  const pdf = await pdfjsLib.getDocument({
    url: src,
    isEvalSupported: false, // keeps the page CSP free of 'unsafe-eval'
    disableRange: true, // the file endpoint streams the whole file
    disableStream: true,
  }).promise;

  const cssWidth = Math.min(root.clientWidth || 360, 900);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  root.replaceChildren();
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.setAttribute('aria-label', `Page ${n} of ${pdf.numPages}`);
    root.appendChild(canvas); // appended first so pages appear as they render

    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  }
};

const renderText = async () => {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const pre = document.createElement('pre');
  pre.textContent = await res.text();
  root.replaceChildren(pre);
};

(async () => {
  try {
    if (kind === 'pdf') await renderPdf();
    else if (kind === 'text') await renderText();
  } catch (err) {
    console.error('Viewer failed:', err);
    showMessage('This report could not be displayed. Please ask the sender for a new link.');
  }
})();
