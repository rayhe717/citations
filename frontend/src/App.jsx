import React, { useState, useEffect, useCallback } from 'react';
import { getDB, getAllPapers, savePaper, paperId } from './db';
import { extractPdfText } from './pdfUtils';
import { extractFromText, citationAnalysis } from './api';
import { buildCsv, downloadCsv } from './csvExport';
import { buildApaList, downloadApaList } from './apaCitation';
import { EXTRACTION_FIELDS } from './constants';
import Dashboard from './components/Dashboard';
import PreviewTable from './components/PreviewTable';
import PdfPreview from './components/PdfPreview';
import CitationAnalysisView from './components/CitationAnalysisView';
import './App.css';

export default function App() {
  const [papers, setPapers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [citationAnalysisPaper, setCitationAnalysisPaper] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadPapers = useCallback(async () => {
    const list = await getAllPapers();
    setPapers(list.sort((a, b) => (b.processedAt || 0) - (a.processedAt || 0)));
  }, []);

  useEffect(() => {
    getDB().then(() => loadPapers());
  }, [loadPapers]);

  const addFiles = useCallback(async (files) => {
    if (!files?.length) return;
    setError(null);
    const toAdd = [];
    for (const file of files) {
      if (file.type !== 'application/pdf') continue;
      const id = paperId(file.name, file.size);
      const existing = papers.find((p) => p.id === id);
      if (existing) continue;
      toAdd.push({
        id,
        fileName: file.name,
        fileSize: file.size,
        fileLastModified: file.lastModified,
        processedAt: null,
        pdfText: null,
        extractedData: null,
        citationAnalysis: null,
        _file: file,
      });
    }
    if (toAdd.length) {
      setPapers((prev) => [...toAdd, ...prev]);
    }
  }, [papers]);

  const runExtraction = useCallback(async (paper) => {
    setError(null);
    setLoading(true);
    try {
      let text = paper.pdfText;
      if (!text && paper._file) {
        text = await extractPdfText(paper._file);
      }
      if (!text?.trim()) {
        throw new Error('No text could be extracted from this PDF.');
      }
      const data = await extractFromText(text);
      const updated = {
        ...paper,
        pdfText: text,
        extractedData: data,
        processedAt: Date.now(),
      };
      await savePaper(updated);
      setPapers((prev) => prev.map((p) => (p.id === paper.id ? { ...updated, _file: p._file } : p)));
      setSelectedId(paper.id);
    } catch (e) {
      setError(e.message || 'Extraction failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const runCitationAnalysis = useCallback(async (paper) => {
    setError(null);
    setLoading(true);
    try {
      let text = paper.pdfText;
      if (!text && paper._file) {
        text = await extractPdfText(paper._file);
      }
      if (!text?.trim()) {
        throw new Error('No text available. Run extraction first.');
      }
      const result = await citationAnalysis(text);
      const updated = {
        ...paper,
        pdfText: paper.pdfText || text,
        citationAnalysis: result,
      };
      await savePaper(updated);
      setPapers((prev) => prev.map((p) => (p.id === paper.id ? { ...updated, _file: p._file } : p)));
      setCitationAnalysisPaper(updated);
    } catch (e) {
      setError(e.message || 'Citation analysis failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExportCsv = useCallback(() => {
    const withData = papers.filter((p) => p.extractedData);
    if (!withData.length) {
      setError('No extracted data to export. Process at least one PDF first.');
      return;
    }
    const csv = buildCsv(withData);
    downloadCsv(csv);
  }, [papers]);

  const handleExportApa = useCallback(() => {
    const list = buildApaList(papers);
    if (!list.trim()) {
      setError('No citations available. Process PDFs first.');
      return;
    }
    downloadApaList(list);
  }, [papers]);

  const selectedPaper = papers.find((p) => p.id === selectedId);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Literature Manager</h1>
        <p className="tagline">PDF extraction, CSV export &amp; APA citations — local-first</p>
      </header>

      {error && (
        <div className="banner error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {loading && (
        <div className="banner loading" role="status">
          Processing… (DeepSeek API)
        </div>
      )}

      <main className="app-main">
        <Dashboard
          papers={papers}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAddFiles={addFiles}
          onRunExtraction={runExtraction}
          onRunCitationAnalysis={runCitationAnalysis}
          onPreviewPdf={setPreviewFile}
          loading={loading}
        />

        <section className="actions-bar">
          <button type="button" className="btn btn-primary" onClick={handleExportCsv}>
            Download CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExportApa}>
            APA 7th Reference List
          </button>
        </section>

        {selectedPaper && (
          <section className="preview-section">
            <h2>Preview: {selectedPaper.fileName}</h2>
            <PreviewTable data={selectedPaper.extractedData} fields={EXTRACTION_FIELDS} />
          </section>
        )}

        {citationAnalysisPaper?.citationAnalysis && (
          <CitationAnalysisView
            paper={citationAnalysisPaper}
            onClose={() => setCitationAnalysisPaper(null)}
          />
        )}
      </main>

      {previewFile && (
        <PdfPreview file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}
