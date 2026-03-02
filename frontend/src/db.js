/**
 * IndexedDB store for processed PDFs and extracted data.
 * All data stays local in the browser.
 */
import { openDB } from 'idb';

const DB_NAME = 'cursor-citations-db';
const DB_VERSION = 2;
const STORE_PAPERS = 'papers';
const STORE_COLLECTIONS = 'collections';

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains(STORE_PAPERS)) {
        const store = db.createObjectStore(STORE_PAPERS, { keyPath: 'id' });
        store.createIndex('by-fileName', 'fileName');
        store.createIndex('by-processedAt', 'processedAt');
      }
      if (oldVersion < 2 && !db.objectStoreNames.contains(STORE_COLLECTIONS)) {
        db.createObjectStore(STORE_COLLECTIONS, { keyPath: 'id' });
      }
    },
  });
}

/**
 * Collection: { id: string, name: string, paperIds: string[], createdAt: number }
 */
export async function getCollections() {
  const db = await getDB();
  const list = await db.getAll(STORE_COLLECTIONS);
  return list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function getCollection(id) {
  const db = await getDB();
  return db.get(STORE_COLLECTIONS, id);
}

export async function saveCollection(collection) {
  const db = await getDB();
  await db.put(STORE_COLLECTIONS, collection);
}

export function newCollectionId() {
  return 'col_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

export async function createCollection(name) {
  const id = newCollectionId();
  const collection = {
    id,
    name: name || 'Untitled',
    paperIds: [],
    createdAt: Date.now(),
  };
  await saveCollection(collection);
  return collection;
}

/**
 * Paper record: { id, fileName, fileSize, processedAt, pdfText?, extractedData?, starred?, tags? }
 * tags: string[] — user-defined tags for filtering
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
