import React, { useState } from 'react';
import './TagsEditor.css';

export default function TagsEditor({ paper, onUpdateTags }) {
  const [input, setInput] = useState('');
  const tags = paper.tags || [];

  const addTag = () => {
    const t = input.trim();
    if (!t || tags.includes(t)) {
      setInput('');
      return;
    }
    onUpdateTags([...tags, t]);
    setInput('');
  };

  const removeTag = (tag) => {
    onUpdateTags(tags.filter((x) => x !== tag));
  };

  return (
    <div className="tags-editor">
      <label className="tags-editor-label">Tags</label>
      <div className="tags-editor-chips">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button
              type="button"
              className="tag-chip-remove"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="tags-editor-input-row">
        <input
          type="text"
          className="tags-editor-input"
          placeholder="Add tag..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          aria-label="Add tag"
        />
        <button type="button" className="btn btn-small" onClick={addTag}>
          Add
        </button>
      </div>
    </div>
  );
}
