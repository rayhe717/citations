/**
 * Backend API calls. Assumes Vite proxy to /api -> localhost:3001.
 */

export async function extractFromText(text) {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
}

export async function testNotionConnection(databaseId) {
  const url = databaseId ? `/api/notion-test?databaseId=${encodeURIComponent(databaseId)}` : '/api/notion-test';
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export async function saveToNotion(papers, databaseId) {
  const payload = papers.map((p) => ({
    fileName: p.fileName,
    extractedData: p.extractedData,
  }));
  const body = databaseId ? { papers: payload, databaseId } : { papers: payload };
  const res = await fetch('/api/notion-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}
