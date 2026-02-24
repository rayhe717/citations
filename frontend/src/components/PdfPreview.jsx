import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function PdfPreview({ file, onClose }) {
  const canvasRef = useRef(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pdfDocRef = useRef(null);

  useEffect(() => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setPage(1);

    let cancelled = false;
    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current || page < 1) return;

    const render = async () => {
      const pdf = pdfDocRef.current;
      const pageObj = await pdf.getPage(page);
      const viewport = pageObj.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await pageObj.render({ canvasContext: ctx, viewport }).promise;
    };
    render();
  }, [page, loading]);

  if (!file) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="PDF preview">
      <div className="modal-content pdf-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{file.name}</h3>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          {loading && <p>Loading PDF…</p>}
          {error && <p className="error-text">{error}</p>}
          {!loading && !error && (
            <>
              <div className="pdf-nav">
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {page} of {numPages}
                </span>
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={page >= numPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
              <div className="pdf-canvas-wrap">
                <canvas ref={canvasRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
