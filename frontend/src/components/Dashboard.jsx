import React, { useRef } from 'react';
import './Dashboard.css';

const statusLabel = (paper) => {
  if (paper.extractedData) return 'Extracted';
  if (paper.citationAnalysis && !paper.extractedData) return 'Citation analysis only';
  return 'Pending';
};

export default function Dashboard({
  papers,
  selectedId,
  onSelect,
  onAddFiles,
  onRunExtraction,
  onRunCitationAnalysis,
  onPreviewPdf,
  loading,
}) {
  const fileInputRef = useRef(null);

  const handleFolderClick = async () => {
    if (typeof showDirectoryPicker !== 'function') {
      fileInputRef.current?.click();
      return;
    }
    try {
      const dir = await showDirectoryPicker({ mode: 'read' });
      const files = [];
      for await (const entry of dir.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
          const file = await entry.getFile();
          files.push(file);
        }
      }
      if (files.length) onAddFiles(files);
      else alert('No PDF files found in the selected folder.');
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files ? [...e.target.files] : [];
    if (files.length) onAddFiles(files);
    e.target.value = '';
  };

  return (
    <section className="dashboard">
      <div className="dashboard-toolbar">
        <button type="button" className="btn btn-primary" onClick={handleFolderClick}>
          Select folder / PDFs
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      <div className="dashboard-list">
        <h3>PDFs ({papers.length})</h3>
        {papers.length === 0 ? (
          <p className="muted">Select a folder or multiple PDF files to start.</p>
        ) : (
          <ul className="paper-list">
            {papers.map((paper) => (
              <li
                key={paper.id}
                className={`paper-item ${selectedId === paper.id ? 'selected' : ''}`}
              >
                <button
                  type="button"
                  className="paper-row"
                  onClick={() => onSelect(paper.id)}
                >
                  <span className="paper-name" title={paper.fileName}>
                    {paper.fileName}
                  </span>
                  <span className={`paper-status status-${statusLabel(paper).toLowerCase().replace(/\s+/g, '-')}`}>
                    {statusLabel(paper)}
                  </span>
                </button>
                <div className="paper-actions">
                  {(paper._file || paper.pdfText) && (
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRunExtraction(paper);
                      }}
                      disabled={loading || !!paper.extractedData}
                      title={paper.extractedData ? 'Already extracted' : 'Extract data via DeepSeek'}
                    >
                      {paper.extractedData ? 'Done' : 'Extract'}
                    </button>
                  )}
                  {(paper._file || paper.pdfText) && (
                    <button
                      type="button"
                      className="btn btn-small btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRunCitationAnalysis(paper);
                      }}
                      disabled={loading}
                      title="Citation frequency analysis"
                    >
                      Citations
                    </button>
                  )}
                  {paper._file && (
                    <button
                      type="button"
                      className="btn btn-small btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewPdf(paper._file);
                      }}
                      title="Preview PDF"
                    >
                      Preview
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
