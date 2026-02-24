/**
 * Export extracted papers to CSV. Columns match EXTRACTION_FIELDS.
 */
import { EXTRACTION_FIELDS } from './constants';

function escapeCsvCell(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {Array<{ extractedData: Record<string, string> }>} papers
 * @returns {string} CSV content
 */
export function buildCsv(papers) {
  const header = EXTRACTION_FIELDS.map(escapeCsvCell).join(',');
  const rows = papers
    .filter((p) => p.extractedData)
    .map((p) =>
      EXTRACTION_FIELDS.map((key) => escapeCsvCell(p.extractedData[key])).join(',')
    );
  return [header, ...rows].join('\r\n');
}

/**
 * Trigger download of CSV file.
 */
export function downloadCsv(content, filename = 'literature-export.csv') {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
