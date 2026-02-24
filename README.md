# Literature Manager — Local-First PDF Extraction & Citations

A **local-first** web app for organizing literature PDFs and extracting structured data using the **DeepSeek API**. Built for dissertation writing: literature management, data extraction, CSV export, and citation tracking. All processing runs locally in your browser and on your machine; PDFs and extracted data are never sent to the cloud except to the DeepSeek API for extraction.

## Features

- **Folder / multi-file selection** — Choose a folder of PDFs (or select multiple PDFs). Uses the File System Access API where supported, with a fallback file input.
- **PDF preview** — Preview any selected PDF before extraction.
- **Structured extraction** — For each PDF, extract 38 fields (citation, study ID, authors, design, outcomes, effect sizes, limitations, etc.) via the DeepSeek API.
- **Local storage** — Processed metadata and extracted text are stored in **IndexedDB** in your browser. Processed PDFs are remembered across sessions; re-processing is avoided.
- **Preview table** — View extracted data in a table before exporting.
- **CSV export** — Download a CSV of all extracted data, ready for Excel or Google Sheets.
- **APA 7th reference list** — Generate a cumulative reference list in APA 7th edition format from all processed PDFs.
- **Citation analysis** — For each PDF, identify the most frequently cited references to surface theoretical foundations and key sources.

## Requirements

- **Node.js** 18+ (for the local server and API proxy)
- **DeepSeek API key** — [Get one here](https://platform.deepseek.com/). The key is used only for extraction and citation analysis; it is not stored in the frontend.

## Setup and run

### 1. Install dependencies

```bash
cd /path/to/cursor-citations
npm install
cd frontend && npm install && cd ..
```

### 2. Configure environment

Copy the example env file and add your DeepSeek API key:

```bash
cp .env.example .env
```

Edit `.env` and set:

```
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

Optional: set `PORT=3001` (or another port) if you need a different server port.

### 3. Run the app

**Option A — Development (recommended)**  
Runs the backend and Vite dev server with hot reload:

```bash
npm run dev
```

- Backend: http://localhost:3001  
- Frontend: http://localhost:5173  

Use **http://localhost:5173** in your browser so the Vite proxy forwards `/api` to the backend.

**Option B — Backend only (e.g. for production build)**

```bash
npm run server
```

Then build and serve the frontend:

```bash
npm run build
```

Open http://localhost:3001 (the server serves the built frontend from `frontend/dist`).

### 4. Use the app

1. Open the app in a modern desktop browser (Chrome, Edge, or Firefox).
2. Click **“Select folder / PDFs”** and choose a folder containing PDFs, or select multiple PDF files.
3. For each PDF you can:
   - **Preview** — Open a quick PDF preview (when the file is still in the current session).
   - **Extract** — Send the PDF text to the backend; DeepSeek returns structured data, which is saved locally.
   - **Citations** — Run citation analysis to see the most cited references in that PDF.
4. Use **“Download CSV”** to export all extracted data and **“APA 7th Reference List”** to download the cumulative citation list.

## Project structure

```
cursor-citations/
├── .env                 # Your API key (create from .env.example)
├── .env.example
├── package.json         # Backend deps + scripts
├── server.js            # Express server + DeepSeek proxy
├── README.md
└── frontend/
    ├── package.json
    ├── vite.config.js   # Dev proxy /api -> localhost:3001
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── constants.js       # Extraction field names
        ├── db.js              # IndexedDB (idb)
        ├── pdfUtils.js       # PDF.js text extraction
        ├── api.js            # fetch /api/extract, /api/citation-analysis
        ├── csvExport.js      # CSV build + download
        ├── apaCitation.js    # APA list build + download
        └── components/
            ├── Dashboard.jsx
            ├── Dashboard.css
            ├── PreviewTable.jsx
            ├── PdfPreview.jsx
            └── CitationAnalysisView.jsx
```

## API endpoints (backend)

- **POST /api/extract**  
  Body: `{ "text": "<PDF text>" }`  
  Returns: `{ "data": { "<field>": "<value>", ... } }`  
  Used to extract the 38 structured fields from PDF text via DeepSeek.

- **POST /api/citation-analysis**  
  Body: `{ "text": "<PDF text>" }`  
  Returns: `{ "references": [...], "topCited": [{ "reference", "count" }] }`  
  Used to get the reference list and most frequently cited references.

## Privacy and local-first behavior

- PDFs are read **only in your browser** with PDF.js. Full text is sent to your local server, which forwards it to the DeepSeek API for extraction and citation analysis.
- Extracted data and citation lists are stored in **IndexedDB** on your device. No cloud storage is used for your files or extracted data.
- The app is designed to run fully locally on a desktop browser; no cloud file storage or account is required beyond the DeepSeek API key for extraction.

## Extracted fields (CSV columns)

Citation, Study ID, Authors, Year, Country/Region, Funding Source, Study Design, Population/Setting, Sample Size (N), Mean Age (SD), Gender Breakdown, Inclusion/Exclusion Criteria, Recruitment Method, Intervention details (name, description, frequency, duration, delivery mode), Comparator/Control, Adherence/Fidelity, Primary/Secondary Outcomes, Outcome Measures/Scales, Assessment Timepoints, Statistical Analyses, Effect Sizes (with CI), Mediators/Moderators, Main Results, Harms/Adverse Events, RoB (incomplete outcome data), Strengths, Limitations, Authors’ Gaps/Future Research, Practical Implications, Notes/Relevance to My Study.

## License

MIT.
