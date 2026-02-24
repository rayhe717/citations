import React from 'react';

export default function CitationAnalysisView({ paper, onClose }) {
  const { topCited = [], references = [] } = paper.citationAnalysis || {};

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Citation analysis">
      <div className="modal-content citation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Citation analysis — {paper.fileName}</h3>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <section className="citation-section">
            <h4>Most cited references</h4>
            {topCited.length === 0 ? (
              <p className="muted">No citation counts returned.</p>
            ) : (
              <ol className="citation-list">
                {topCited.map((item, i) => (
                  <li key={i}>
                    <span className="citation-count">{item.count}×</span>
                    <span className="citation-ref">{item.reference}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {references.length > 0 && (
            <section className="citation-section">
              <h4>Reference list ({references.length})</h4>
              <ul className="reference-list">
                {references.slice(0, 50).map((ref, i) => (
                  <li key={i}>{ref}</li>
                ))}
              </ul>
              {references.length > 50 && (
                <p className="muted">… and {references.length - 50} more</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
