/**
 * IndexedDB store for processed PDFs and extracted data.
 * All data stays local in the browser.
 */
import { openDB } from 'idb';

const DB_NAME = 'cursor-citations-db';
const DB_VERSION = 1;
const STORE_PAPERS = 'papers';

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_PAPERS)) {
        const store = db.createObjectStore(STORE_PAPERS, { keyPath: 'id' });
        store.createIndex('by-fileName', 'fileName');
        store.createIndex('by-processedAt', 'processedAt');
      }
    },
  });
}

/**
 * Paper record: { id, fileName, fileSize, processedAt, pdfText?, extractedData?, citationAnalysis? }
 */
export function paperId(fileName, fileSize) {
  return `${fileName}_${fileSize}`;
}

export async function savePaper(paper) {
  const db = await getDB();
  const { _file, ...storable } = paper;
  await db.put(STORE_PAPERS, storable);
}

export async function getPaper(id) {
  const db = await getDB();
  return db.get(STORE_PAPERS, id);
}

export async function getAllPapers() {
  const db = await getDB();
  return db.getAll(STORE_PAPERS);
}

export async function deletePaper(id) {
  const db = await getDB();
  await db.delete(STORE_PAPERS, id);
}

export async function clearAllPapers() {
  const db = await getDB();
  const tx = db.transaction(STORE_PAPERS, 'readwrite');
  await tx.store.clear();
  await tx.done;
}
