/**
 * APA 7th citation list from stored papers.
 * Uses the "Citation" field from extraction when available; otherwise builds a placeholder.
 */

/**
 * @param {Array<{ fileName: string, extractedData?: Record<string, string> }>} papers
 * @returns {string} Numbered list of citations, APA 7th style
 */
export function buildApaList(papers) {
  const withCitation = papers.filter((p) => p.extractedData?.Citation?.trim());
  const lines = withCitation.map((p) => p.extractedData.Citation.trim());
  // Dedupe by citation text (same paper might appear twice)
  const seen = new Set();
  const unique = lines.filter((c) => {
    const key = c.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.map((c, i) => `${i + 1}. ${c}`).join('\n\n');
}

/**
 * Download as .txt file.
 */
export function downloadApaList(content, filename = 'apa-references.txt') {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
