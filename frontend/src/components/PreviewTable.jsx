import React, { useState } from 'react';

export default function PreviewTable({ data, fields }) {
  const [expanded, setExpanded] = useState(false);

  if (!data) {
    return <p className="muted">No extracted data. Run &quot;Extract&quot; for this PDF.</p>;
  }

  const displayFields = expanded ? fields : fields.slice(0, 12);

  return (
    <div className="table-wrap">
      <table className="preview-table">
        <tbody>
          {displayFields.map((key) => (
            <tr key={key}>
              <th>{key}</th>
              <td>{data[key] != null && data[key] !== '' ? String(data[key]) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {fields.length > 12 && (
        <div className="expand-row">
          <button
            type="button"
            className="btn btn-small btn-secondary"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? 'Show less' : `Show all ${fields.length} fields`}
          </button>
        </div>
      )}
    </div>
  );
}
