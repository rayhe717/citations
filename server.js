/**
 * Local backend for cursor-citations.
 * Serves the frontend and proxies extraction requests to the DeepSeek API.
 * All PDF handling and storage happen in the browser; this server only runs extraction.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

/** Read env var with trimming (handles accidental whitespace in .env). */
function env(key) {
  const v = process.env[key];
  return v != null ? String(v).trim() : null;
}
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// API routes (must be before static so /api/* is not served as files)
// Extraction schema: all fields we want from each PDF
const EXTRACTION_FIELDS = [
  'Citation', 'Authors', 'Year',
  'Study Design', 'Population/Setting', 'Sample Size (N)', 'Mean Age (SD)', 'Gender Breakdown',
  'Inclusion Criteria', 'Exclusion Criteria', 'Recruitment Method', 'Intervention Name',
  'Intervention Description', 'Intervention Frequency', 'Intervention Duration',
  'Delivery Mode', 'Comparator/Control', 'Adherence/Fidelity Monitoring',
  'Primary Outcomes', 'Secondary Outcomes', 'Outcome Measures/Scales',
  'Assessment Timepoints (baseline, post, follow-up)', 'Statistical Analyses',
  'Effect Sizes (with CI)', 'Mediators Tested', 'Moderators Tested', 'Main Results/Findings',
  'Strengths', 'Limitations', "Authors' Stated Gaps/Future Research", 'Practical Implications',
  'Notes/Relevance to My Study'
];

function buildExtractionPrompt(text) {
  const fieldList = EXTRACTION_FIELDS.map(f => `"${f}"`).join(', ');
  return `You are a research assistant. Extract structured data from the following academic paper text. 
Return a single JSON object with exactly these keys (use empty string "" if not found or not applicable): ${fieldList}.

Rules:
- Use APA 7th edition for the "Citation" field.
- For "Delivery Mode", use exactly one of: paper, app, online, other.
- Keep values concise; use "N/A" only when the concept does not apply.
- Preserve numbers and statistics as in the text (e.g. for Mean Age, Effect Sizes).
- Do not include any text outside the JSON object.

Paper text:
---
${text.slice(0, 120000)}
---

Respond with only the JSON object, no markdown or explanation.`;
}

/**
 * POST /api/extract
 * Body: { text: string } (PDF text extracted in browser)
 * Returns: { data: object } with extracted fields, or { error: string }
 */
app.post('/api/extract', async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'DEEPSEEK_API_KEY is not set. Add it to .env.' });
  }

  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Request body must include "text" (PDF text).' });
  }

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com',
  });

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'user', content: buildExtractionPrompt(text) },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '';
    // Strip possible markdown code block
    const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    const data = JSON.parse(jsonStr);

    // Normalize keys to our schema (fill missing with "")
    const result = {};
    for (const key of EXTRACTION_FIELDS) {
      result[key] = data[key] != null ? String(data[key]).trim() : '';
    }

    return res.json({ data: result });
  } catch (err) {
    console.error('Extraction error:', err.message);
    const message = err.message || 'Extraction failed';
    const status = err.status === 429 ? 429 : 502;
    return res.status(status).json({ error: message });
  }
});

// --- Notion sync (main store) ---
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const RICH_TEXT_MAX = 2000;

function chunkText(str) {
  const s = String(str ?? '');
  const out = [];
  for (let i = 0; i < s.length; i += RICH_TEXT_MAX) {
    out.push({ type: 'text', text: { content: s.slice(i, i + RICH_TEXT_MAX) } });
  }
  return out.length ? out : [{ type: 'text', text: { content: '' } }];
}

const DELIVERY_MODE_OPTIONS = ['paper', 'app', 'online', 'other'];

function mapDeliveryMode(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return 'other';
  if (v.includes('paper')) return 'paper';
  if (v.includes('app')) return 'app';
  if (v.includes('online') || v.includes('web')) return 'online';
  return DELIVERY_MODE_OPTIONS.includes(v) ? v : 'other';
}

function buildNotionProperties(extractedData) {
  const props = {};
  for (const [key, value] of Object.entries(extractedData || {})) {
    if (key === 'Citation') {
      const content = String(value ?? '').trim();
      const chunks = chunkText(content);
      props[key] = { title: chunks.length ? chunks : [{ type: 'text', text: { content: '' } }] };
      continue;
    }
    if (key === 'Delivery Mode') {
      const option = mapDeliveryMode(value);
      props[key] = { select: { name: option } };
      continue;
    }
    const content = String(value ?? '').trim();
    const chunks = chunkText(content);
    props[key] = { rich_text: chunks.length ? chunks : [{ type: 'text', text: { content: '' } }] };
  }
  return props;
}

/** Normalize Notion database ID to valid UUID (Notion rejects underscores). */
function normalizeNotionDatabaseId(id) {
  if (!id || typeof id !== 'string') return id;
  const hex = id.replace(/[-_]/g, '').trim();
  if (hex.length === 32 && /^[0-9a-fA-F]+$/.test(hex)) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  return id;
}

async function notionFetch(path, options = {}) {
  const key = env('NOTION_API_KEY');
  if (!key) throw new Error('NOTION_API_KEY is not set.');
  const res = await fetch(`${NOTION_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res;
}

async function findNotionPageByCitation(databaseId, citationText) {
  if (!citationText || !databaseId) return null;
  const res = await notionFetch(`/databases/${databaseId}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Citation',
        title: { equals: citationText },
      },
      page_size: 1,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const page = data.results?.[0];
  return page?.id ?? null;
}

/**
 * GET /api/ping — instant response, no external calls. Use to verify server is reachable.
 */
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

/**
 * GET /api/notion-test
 * Verifies Notion connection (API key + database access). Returns { ok: true, databaseTitle } or { ok: false, error }.
 */
app.get('/api/notion-test', async (req, res) => {
  if (!env('NOTION_API_KEY')) {
    return res.status(503).json({ ok: false, error: 'NOTION_API_KEY is not set. Add it to .env.' });
  }
  const reqId = req.query.databaseId;
  const rawId = (reqId && String(reqId).trim()) || env('NOTION_DATABASE_ID');
  const databaseId = normalizeNotionDatabaseId(rawId);
  if (!rawId || !databaseId) {
    return res.status(503).json({ ok: false, error: 'No Notion database. Set NOTION_DATABASE_ID in .env or configure a database for this folder.' });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const fetchRes = await fetch(`${NOTION_API}/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env('NOTION_API_KEY')}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!fetchRes.ok) {
      const errBody = await fetchRes.json().catch(() => ({}));
      const msg = errBody.message || errBody.code || `HTTP ${fetchRes.status}`;
      return res.json({ ok: false, error: msg });
    }
    const data = await fetchRes.json();
    const title = data.title?.[0]?.plain_text ?? data.id ?? 'Database';
    return res.json({ ok: true, databaseTitle: title });
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    const error = isTimeout
      ? 'Notion API request timed out (10s). Check network or firewall.'
      : (err.cause?.message || err.code || err.message || 'Request failed');
    return res.json({ ok: false, error });
  }
});

/**
 * POST /api/notion-sync
 * Body: { papers: [{ fileName, extractedData }] }
 * Returns: { created, updated, errors: [{ index, fileName, error }] }
 */
app.post('/api/notion-sync', async (req, res) => {
  if (!env('NOTION_API_KEY')) {
    return res.status(503).json({ error: 'NOTION_API_KEY is not set. Add it to .env.' });
  }
  const { papers, databaseId: reqDatabaseId } = req.body;
  const rawId = (reqDatabaseId && String(reqDatabaseId).trim()) || env('NOTION_DATABASE_ID');
  const databaseId = normalizeNotionDatabaseId(rawId);
  if (!rawId || !databaseId) {
    return res.status(503).json({ error: 'No Notion database. Set NOTION_DATABASE_ID in .env or configure a database for this folder.' });
  }
  if (!Array.isArray(papers) || papers.length === 0) {
    return res.status(400).json({ error: 'Request body must include "papers" (non-empty array).' });
  }

  let created = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < papers.length; i++) {
    const { fileName, extractedData } = papers[i] || {};
    if (!extractedData || typeof extractedData !== 'object') {
      errors.push({ index: i, fileName: fileName || 'unknown', error: 'Missing extractedData' });
      continue;
    }

    const properties = buildNotionProperties(extractedData);
    const citationText = (extractedData['Citation'] ?? '').trim();

    try {
      const existingPageId = await findNotionPageByCitation(databaseId, citationText);

      if (existingPageId) {
        const patchRes = await notionFetch(`/pages/${existingPageId}`, {
          method: 'PATCH',
          body: JSON.stringify({ properties }),
        });
        if (!patchRes.ok) {
          const errBody = await patchRes.json().catch(() => ({}));
          throw new Error(errBody.message || `Notion PATCH failed: ${patchRes.status}`);
        }
        updated++;
      } else {
        const createRes = await notionFetch('/pages', {
          method: 'POST',
          body: JSON.stringify({
            parent: { database_id: databaseId },
            properties,
          }),
        });
        if (!createRes.ok) {
          const errBody = await createRes.json().catch(() => ({}));
          throw new Error(errBody.message || `Notion create failed: ${createRes.status}`);
        }
        created++;
      }
    } catch (err) {
      errors.push({ index: i, fileName: fileName || 'unknown', error: err.message || 'Sync failed' });
    }
  }

  return res.json({ created, updated, errors });
});

// Serve built frontend (after API routes)
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn('Warning: DEEPSEEK_API_KEY not set. Extraction will fail.');
  }
});
