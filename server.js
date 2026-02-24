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
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Production: serve built frontend
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Extraction schema: all fields we want from each PDF
const EXTRACTION_FIELDS = [
  'Citation', 'Study ID', 'Authors', 'Year', 'Country/Region', 'Funding Source',
  'Study Design', 'Population/Setting', 'Sample Size (N)', 'Mean Age (SD)', 'Gender Breakdown',
  'Inclusion Criteria', 'Exclusion Criteria', 'Recruitment Method', 'Intervention Name',
  'Intervention Description', 'Intervention Frequency', 'Intervention Duration',
  'Delivery Mode (paper/app/online)', 'Comparator/Control', 'Adherence/Fidelity Monitoring',
  'Primary Outcomes', 'Secondary Outcomes', 'Outcome Measures/Scales',
  'Assessment Timepoints (baseline, post, follow-up)', 'Statistical Analyses',
  'Effect Sizes (with CI)', 'Mediators Tested', 'Moderators Tested', 'Main Results/Findings',
  'Harms/Adverse Events', 'RoB: Incomplete Outcome Data', 'Strengths', 'Limitations',
  "Authors' Stated Gaps/Future Research", 'Practical Implications', 'Notes/Relevance to My Study'
];

function buildExtractionPrompt(text) {
  const fieldList = EXTRACTION_FIELDS.map(f => `"${f}"`).join(', ');
  return `You are a research assistant. Extract structured data from the following academic paper text. 
Return a single JSON object with exactly these keys (use empty string "" if not found or not applicable): ${fieldList}.

Rules:
- Use APA 7th edition for the "Citation" field.
- For "Study ID", assign a short identifier (e.g. first author surname + year).
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

/**
 * POST /api/citation-analysis
 * Body: { text: string } (full PDF text)
 * Returns: { references: string[], topCited: { ref: string, count: number }[] }
 */
app.post('/api/citation-analysis', async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'DEEPSEEK_API_KEY is not set.' });
  }

  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Request body must include "text".' });
  }

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com',
  });

  const prompt = `Below is the text of an academic paper. Extract the reference list (bibliography) at the end. 
Then identify which of these references are cited most often in the body of the paper (in-text citations). 
Return a JSON object with two keys:
1) "references": array of strings, each string is one full reference as it appears in the reference list.
2) "citationCounts": array of objects with "reference" (string, the reference text) and "count" (number, how many times it was cited in the text). Sort by count descending. Include only references that appear at least once.

Paper text:
---
${text.slice(0, 80000)}
---

Respond with only the JSON object, no markdown.`;

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '';
    const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    const out = JSON.parse(jsonStr);
    return res.json({
      references: out.references || [],
      topCited: (out.citationCounts || []).slice(0, 30),
    });
  } catch (err) {
    console.error('Citation analysis error:', err.message);
    return res.status(502).json({ error: err.message || 'Citation analysis failed' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn('Warning: DEEPSEEK_API_KEY not set. Extraction and citation analysis will fail.');
  }
});
