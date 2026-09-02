import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
// Vite bundles the worker as a same-origin asset — required so it satisfies
// CSP without adding a third-party script-src exception (no CDN worker src).
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

// Renders every page of the PDF as canvas, inside the page itself — no iframe,
// no OS-native PDF viewer, no navigating away. Identical behavior on desktop,
// Android, iOS Safari, and any WebView, because none of them get to decide
// how the PDF is displayed.
export default function PdfViewer({ url, title }) {
  const containerRef = useRef(null);
  const [numPages, setNumPages] = useState(null);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setError(false);
  }, []);

  const onLoadError = useCallback(() => {
    setError(true);
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-lg">
        <p className="text-sm text-slate-600 mb-4">
          Couldn't load {title || "the document"} here. You can still download it directly.
        </p>
        <a
          href={url}
          download
          className="inline-block rounded-lg bg-landing-primary-hover px-6 py-3 font-semibold text-white no-underline transition hover:bg-landing-primary"
        >
          Download PDF
        </a>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full overflow-y-auto rounded-lg border border-slate-200 shadow-lg bg-slate-50" style={{ maxHeight: "calc(100vh - 220px)" }}>
      <Document
        file={url}
        onLoadSuccess={onLoadSuccess}
        onLoadError={onLoadError}
        loading={
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            Loading document…
          </div>
        }
      >
        {width > 0 &&
          Array.from({ length: numPages || 0 }, (_, i) => (
            <div key={i} className="flex justify-center py-3 border-b border-slate-200 last:border-b-0">
              <Page pageNumber={i + 1} width={Math.min(width - 24, 800)} />
            </div>
          ))}
      </Document>
    </div>
  );
}
