import React, { useState, useEffect, useCallback } from 'react';
import { getDB, getAllPapers, savePaper, deletePaper, paperId, getCollections, getCollection, saveCollection, createCollection } from './db';

const CURRENT_COLLECTION_KEY = 'cursor-citations-current-collection';
import { extractPdfText } from './pdfUtils';
import { extractFromText, citationAnalysis } from './api';
import { buildCsv, downloadCsv } from './csvExport';
import { buildApaList, downloadApaList } from './apaCitation';
import { EXTRACTION_FIELDS, MAX_PAPERS } from './constants';
import Dashboard from './components/Dashboard';
import PreviewTable from './components/PreviewTable';
import TagsEditor from './components/TagsEditor';
import PdfPreview from './components/PdfPreview';
import CitationAnalysisView from './components/CitationAnalysisView';
import './App.css';

export default function App() {
  const [papers, setPapers] = useState([]);
  const [collections, setCollections] = useState([]);
  const [currentCollectionId, setCurrentCollectionId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [starredOnly, setStarredOnly] = useState(false);
  const [filterTags, setFilterTags] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [citationAnalysisPaper, setCitationAnalysisPaper] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggleSelection = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const sortByFileName = useCallback((list) =>
    [...list].sort((a, b) =>
      (a.fileName || '').localeCompare(b.fileName || '', undefined, { sensitivity: 'base' })
    ), []);

  const loadPapers = useCallback(async () => {
    const list = await getAllPapers();
    const normalized = list.map((p) => ({
      ...p,
      starred: p.starred === true,
      tags: Array.isArray(p.tags) ? p.tags : [],
    }));
    setPapers(sortByFileName(normalized));
  }, [sortByFileName]);

  const loadCollections = useCallback(async () => {
    const list = await getCollections();
    setCollections(list);
    if (list.length > 0) {
      const saved = localStorage.getItem(CURRENT_COLLECTION_KEY);
      const id = saved && list.some((c) => c.id === saved) ? saved : list[0].id;
      setCurrentCollectionId((prev) => prev || id);
      localStorage.setItem(CURRENT_COLLECTION_KEY, id);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getDB()
      .then(() => loadPapers())
      .then(async () => {
        const list = await getAllPapers();
        const ids = list.map((p) => p.id);
        const colls = await getCollections();
        if (colls.length === 0) {
          const defaultCol = {
            id: 'default',
            name: 'Default',
            paperIds: ids,
            createdAt: Date.now(),
          };
          await saveCollection(defaultCol);
          if (mounted) {
            setCollections([defaultCol]);
            setCurrentCollectionId('default');
            localStorage.setItem(CURRENT_COLLECTION_KEY, 'default');
          }
        } else if (mounted) {
          await loadCollections();
        }
      });
    return () => { mounted = false; };
  }, [loadPapers, loadCollections]);

  useEffect(() => {
    if (currentCollectionId) localStorage.setItem(CURRENT_COLLECTION_KEY, currentCollectionId);
  }, [currentCollectionId]);

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
        starred: false,
        tags: [],
        _file: file,
      });
    }
    if (toAdd.length) {
      const newIds = toAdd.map((p) => p.id);
      setPapers((prev) => sortByFileName([...toAdd, ...prev]));
      if (currentCollectionId) {
        const coll = collections.find((c) => c.id === currentCollectionId);
        if (coll) {
          const updated = { ...coll, paperIds: [...(coll.paperIds || []), ...newIds] };
          await saveCollection(updated);
          setCollections((prev) => prev.map((c) => (c.id === currentCollectionId ? updated : c)));
        }
      }
    }
  }, [papers, sortByFileName, currentCollectionId, collections]);

  const runExtractionForPaper = useCallback(async (paper) => {
    let text = paper.pdfText;
    if (!text && paper._file) {
      text = await extractPdfText(paper._file);
    }
    if (!text?.trim()) throw new Error(`No text could be extracted from ${paper.fileName}.`);
    const data = await extractFromText(text);
    const updated = {
      ...paper,
      pdfText: text,
      extractedData: data,
      processedAt: Date.now(),
    };
    await savePaper(updated);
    return updated;
  }, []);

  const handleExtractSelected = useCallback(async () => {
    if (selectedIds.length === 0) {
      setError('Select at least one article (use checkboxes).');
      return;
    }
    if (selectedIds.length > MAX_PAPERS) {
      setError(`Select up to ${MAX_PAPERS} articles for extraction.`);
      return;
    }
    setError(null);
    setLoading(true);
    const toProcess = papers.filter((p) => selectedIds.includes(p.id) && (p._file || p.pdfText));
    const withoutFile = selectedIds.filter((id) => !papers.find((p) => p.id === id && (p._file || p.pdfText)));
    if (withoutFile.length) {
      setError('Some selected articles have no file or text. Add the folder again or skip them.');
      setLoading(false);
      return;
    }
    try {
      for (let i = 0; i < toProcess.length; i++) {
        const paper = toProcess[i];
        const updated = await runExtractionForPaper(paper);
        setPapers((prev) => prev.map((p) => (p.id === paper.id ? { ...updated, _file: p._file } : p)));
      }
      if (toProcess.length) setSelectedId(toProcess[0].id);
    } catch (e) {
      setError(e.message || 'Extraction failed');
    } finally {
      setLoading(false);
    }
  }, [selectedIds, papers, runExtractionForPaper]);

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
    const selected = papers.filter((p) => selectedIds.includes(p.id));
    if (selected.length === 0) {
      setError('Select at least one article for CSV export (use checkboxes).');
      return;
    }
    if (selected.length > MAX_PAPERS) {
      setError(`Select up to ${MAX_PAPERS} articles for CSV export.`);
      return;
    }
    const withData = selected.filter((p) => p.extractedData);
    if (!withData.length) {
      setError('No extracted data for selected articles. Run "Extract selected" first.');
      return;
    }
    const csv = buildCsv(withData);
    downloadCsv(csv);
  }, [papers, selectedIds]);

  const handleExportApa = useCallback(() => {
    const selected = papers.filter((p) => selectedIds.includes(p.id));
    if (selected.length === 0) {
      setError('Select at least one article for the reference list (use checkboxes).');
      return;
    }
    const list = buildApaList(selected);
    if (!list.trim()) {
      setError('No citations in selected articles. Run extraction first.');
      return;
    }
    downloadApaList(list);
  }, [papers, selectedIds]);

  const removePaper = useCallback(async (id) => {
    setError(null);
    await deletePaper(id);
    setPapers((prev) => prev.filter((p) => p.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    if (selectedId === id) setSelectedId(null);
    const coll = collections.find((c) => c.id === currentCollectionId);
    if (coll?.paperIds?.includes(id)) {
      const updated = { ...coll, paperIds: coll.paperIds.filter((x) => x !== id) };
      await saveCollection(updated);
      setCollections((prev) => prev.map((c) => (c.id === currentCollectionId ? updated : c)));
    }
  }, [selectedId, currentCollectionId, collections]);

  const toggleStarred = useCallback(async (paper) => {
    const updated = { ...paper, starred: !paper.starred };
    await savePaper(updated);
    setPapers((prev) => prev.map((p) => (p.id === paper.id ? { ...updated, _file: p._file } : p)));
  }, []);

  const updatePaperTags = useCallback(async (id, tags) => {
    const paper = papers.find((p) => p.id === id);
    if (!paper) return;
    const updated = { ...paper, tags };
    await savePaper(updated);
    setPapers((prev) => prev.map((p) => (p.id === id ? { ...updated, _file: p._file } : p)));
  }, [papers]);

  const currentCollection = collections.find((c) => c.id === currentCollectionId);
  const papersInView = React.useMemo(
    () =>
      currentCollection?.paperIds?.length
        ? papers.filter((p) => currentCollection.paperIds.includes(p.id))
        : papers,
    [papers, currentCollection]
  );

  const allTags = React.useMemo(() => {
    const set = new Set();
    papersInView.forEach((p) => (p.tags || []).forEach((t) => set.add(t.trim())));
    return Array.from(set).filter(Boolean).sort();
  }, [papersInView]);

  const toggleFilterTag = useCallback((tag) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleSwitchCollection = useCallback((id) => {
    setCurrentCollectionId(id);
    setSelectedId(null);
    setSelectedIds([]);
  }, []);

  const handleNewCollection = useCallback(async () => {
    const col = await createCollection('New folder');
    setCollections((prev) => [...prev, col]);
    setCurrentCollectionId(col.id);
    setSelectedId(null);
    setSelectedIds([]);
  }, []);

  const handleRenameCollection = useCallback(async (id, newName) => {
    const name = (newName || '').trim();
    if (!name) return;
    const coll = collections.find((c) => c.id === id);
    if (!coll) return;
    const updated = { ...coll, name };
    await saveCollection(updated);
    setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, [collections]);

  let filteredPapers = starredOnly ? papersInView.filter((p) => p.starred) : papersInView;
  if (filterTags.length > 0) {
    filteredPapers = filteredPapers.filter((p) =>
      (p.tags || []).some((t) => filterTags.includes(t))
    );
  }
  const selectedPaper = papers.find((p) => p.id === selectedId);
  const starredCount = papersInView.filter((p) => p.starred).length;
  const citationsPaper =
    selectedPaper && (selectedPaper.pdfText || selectedPaper._file)
      ? selectedPaper
      : papers.find((p) => selectedIds.includes(p.id) && (p.pdfText || p._file));
  const citationsDisabled = loading || !citationsPaper;

  const collectionExtractedCounts = React.useMemo(() => {
    const out = {};
    collections.forEach((c) => {
      out[c.id] = (c.paperIds || []).filter((id) => {
        const p = papers.find((x) => x.id === id);
        return p && p.extractedData;
      }).length;
    });
    return out;
  }, [collections, papers]);

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
          papers={filteredPapers}
          collections={collections}
          collectionExtractedCounts={collectionExtractedCounts}
          currentCollectionId={currentCollectionId}
          currentCollectionName={currentCollection?.name}
          onSwitchCollection={handleSwitchCollection}
          onNewCollection={handleNewCollection}
          onRenameCollection={handleRenameCollection}
          selectedId={selectedId}
          selectedIds={selectedIds}
          starredOnly={starredOnly}
          starredCount={starredCount}
          allTags={allTags}
          filterTags={filterTags}
          onStarredOnlyChange={setStarredOnly}
          onToggleStarred={toggleStarred}
          onToggleFilterTag={toggleFilterTag}
          onExtractSelected={handleExtractSelected}
          onExportCsv={handleExportCsv}
          onExportApa={handleExportApa}
          onRunCitations={() => citationsPaper && runCitationAnalysis(citationsPaper)}
          extractDisabled={loading || selectedIds.length === 0 || selectedIds.length > MAX_PAPERS}
          citationsDisabled={citationsDisabled}
          onSelect={setSelectedId}
          onAddFiles={addFiles}
          onRemovePaper={removePaper}
          onToggleSelection={toggleSelection}
          onPreviewPdf={setPreviewFile}
          loading={loading}
        />

        {selectedPaper && (
          <section className="preview-section">
            <h2>Preview: {selectedPaper.fileName}</h2>
            <TagsEditor
              paper={selectedPaper}
              onUpdateTags={(tags) => updatePaperTags(selectedPaper.id, tags)}
            />
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
