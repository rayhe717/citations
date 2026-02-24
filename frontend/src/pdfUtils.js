/**
 * PDF text extraction using PDF.js. Worker is loaded from CDN for correct path resolution.
 */
import * as pdfjsLib from 'pdfjs-dist';

// Use CDN worker to avoid path issues in Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extract full text from a PDF File.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const parts = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    parts.push(strings.join(' '));
  }

  return parts.join('\n\n');
}

/**
 * Get number of pages (e.g. for preview).
 */
export async function getPdfPageCount(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}
