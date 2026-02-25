import React, { useRef, useState, useEffect } from 'react';
import { MAX_PAPERS } from '../constants';
import './Dashboard.css';

const statusLabel = (paper) => {
  if (paper.extractedData) return 'Extracted';
  if (paper.citationAnalysis && !paper.extractedData) return 'Citation analysis only';
  return 'Pending';
};

export default function Dashboard({
  papers,
  collections,
  collectionExtractedCounts = {},
  currentCollectionId,
  currentCollectionName,
  onSwitchCollection,
  onNewCollection,
  onRenameCollection,
  selectedId,
  selectedIds,
  starredOnly,
  starredCount,
  allTags,
  filterTags,
  onStarredOnlyChange,
  onToggleStarred,
  onToggleFilterTag,
  onExtractSelected,
  onExportCsv,
  onExportApa,
  onRunCitations,
  extractDisabled,
  citationsDisabled,
  onSelect,
  onAddFiles,
  onRemovePaper,
  onToggleSelection,
  onPreviewPdf,
  loading,
}) {
  const fileInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [renameInputValue, setRenameInputValue] = useState('');

  useEffect(() => {
    if (showRenameInput && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [showRenameInput]);

  const startRename = () => {
    setRenameInputValue(currentCollectionName || '');
    setShowRenameInput(true);
  };

  const saveRename = () => {
    const name = renameInputValue.trim();
    if (name && currentCollectionId) {
      onRenameCollection(currentCollectionId, name);
    }
    setShowRenameInput(false);
  };

  const cancelRename = () => {
    setShowRenameInput(false);
  };

  const handleCollectionSelect = (e) => {
    const value = e.target.value;
    e.target.value = currentCollectionId;
    if (value === '__new__') {
      onNewCollection();
    } else if (value && value !== currentCollectionId) {
      onSwitchCollection(value);
    }
  };

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
        {collections?.length > 0 && (
          <div className="toolbar-collection">
            <label className="toolbar-collection-label">Folder:</label>
            {showRenameInput ? (
              <div className="toolbar-rename-inline">
                <input
                  ref={renameInputRef}
                  type="text"
                  className="toolbar-rename-input"
                  value={renameInputValue}
                  onChange={(e) => setRenameInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename();
                    if (e.key === 'Escape') cancelRename();
                  }}
                  placeholder="Folder name"
                  aria-label="New folder name"
                />
                <button type="button" className="btn btn-small" onClick={saveRename}>
                  Save
                </button>
                <button type="button" className="btn btn-small btn-secondary" onClick={cancelRename}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <select
                  className="toolbar-collection-select"
                  value={currentCollectionId || ''}
                  onChange={handleCollectionSelect}
                  title="Switch folder (progress is saved per folder)"
                  aria-label="Switch folder"
                >
                  {(collections || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({collectionExtractedCounts[c.id] ?? 0})
                </option>
                  ))}
                  <option value="__new__">➕ New folder</option>
                </select>
                <button
                  type="button"
                  className="btn btn-rename-folder"
                  onClick={startRename}
                  title="Rename current folder"
                  aria-label="Rename folder"
                >
                  Rename
                </button>
              </>
            )}
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleFolderClick}
          title="Select folder or PDF files (adds to current folder)"
        >
          Select folder / PDFs
        </button>
        {selectedIds.length > 0 && (
          <span className="toolbar-hint">
            {selectedIds.length} selected
            {selectedIds.length > MAX_PAPERS && ` (max ${MAX_PAPERS} for extract/CSV)`}
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      <div className="dashboard-filter">
        <div className="filter-row filter-row-starred">
          <label className="filter-starred">
            <input
              type="checkbox"
              checked={starredOnly}
              onChange={(e) => onStarredOnlyChange(e.target.checked)}
              aria-label="Show starred only"
            />
            <span className="filter-star-icon">★</span>
            <span>Starred only</span>
          </label>
          {starredCount > 0 && (
            <span className="filter-hint">{starredCount} starred</span>
          )}
        </div>
        <div className="filter-row filter-row-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onExtractSelected}
            disabled={extractDisabled}
            title={selectedIds.length > MAX_PAPERS ? `Select up to ${MAX_PAPERS} for extraction` : 'Extract selected articles (max 10)'}
          >
            Extract selected ({selectedIds.length}/{MAX_PAPERS})
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onExportCsv}
            title="Export selected to CSV (max 10)"
          >
            Download CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onExportApa}
            title="APA list from all selected articles"
          >
            APA 7th Reference List
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRunCitations}
            disabled={citationsDisabled}
            title={citationsDisabled ? 'Select an article first' : 'Citation analysis for selected article'}
          >
            Citations
          </button>
        </div>
        {allTags.length > 0 && (
          <div className="filter-row filter-row-tags">
            <span className="filter-tags-label">Filter by tag:</span>
            <div className="filter-tags-chips">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`filter-tag-chip ${filterTags.includes(tag) ? 'active' : ''}`}
                  onClick={() => onToggleFilterTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
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
                className={`paper-item ${selectedId === paper.id ? 'selected' : ''} ${selectedIds.includes(paper.id) ? 'checkbox-selected' : ''}`}
              >
                <div className="paper-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(paper.id)}
                    onChange={() => onToggleSelection(paper.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${paper.fileName}`}
                  />
                  <button
                    type="button"
                    className={`btn-star ${paper.starred ? 'starred' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStarred(paper);
                    }}
                    title={paper.starred ? 'Unstar' : 'Star (key article)'}
                    aria-label={paper.starred ? `Unstar ${paper.fileName}` : `Star ${paper.fileName}`}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    className="paper-row-preview"
                    onClick={() => onSelect(paper.id)}
                  >
                    <span className="paper-name" title={paper.fileName}>
                      {paper.fileName}
                    </span>
                    <span className="paper-row-meta">
                      {(paper.tags || []).length > 0 && (
                        <span className="paper-tags-inline">
                          {(paper.tags || []).slice(0, 3).map((t) => (
                            <span key={t} className="paper-tag-dot">{t}</span>
                          ))}
                          {(paper.tags || []).length > 3 && (
                            <span className="paper-tag-more">+{(paper.tags || []).length - 3}</span>
                          )}
                        </span>
                      )}
                      <span className={`paper-status status-${statusLabel(paper).toLowerCase().replace(/\s+/g, '-')}`}>
                        {statusLabel(paper)}
                      </span>
                    </span>
                  </button>
                </div>
                <div className="paper-actions">
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
                  <button
                    type="button"
                    className="btn btn-small btn-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePaper(paper.id);
                    }}
                    title="Remove from list"
                    aria-label={`Remove ${paper.fileName}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
