# Notion database setup (Save to Notion)

Notion is the **main store** for extracted paper data. This app syncs selected extracted papers to a Notion database (create or update by **Citation**).

**Multiple folders → multiple databases:** Each folder can map to a different Notion database (all under the same integration). Use the **Notion DB: Configure** button in the toolbar to set the database ID for the current folder. Leave it empty to use the default from `.env`.

## 1. Create a Notion integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations) and click **+ New integration**.
2. Name it (e.g. **Literature Manager**), select your workspace, and click **Submit**.
3. Open the integration and copy the **Internal Integration Secret** (starts with `secret_`). You’ll use this as `NOTION_API_KEY` in `.env`.

## 2. Create the database in Notion

1. In Notion, create a **new page** (e.g. “Literature” or “Papers”).
2. Type `/table` and add a **Table – Full page** database (not inline).
3. Name the database whatever you like (e.g. **Papers**). The app only cares about **property names** and types.

## 3. Add properties (exact names)

The app sends one row per paper. Property **names** must match exactly (including punctuation). Add these in order:

| Property name | Type in Notion |
|---------------|-----------------|
| **Citation** | **Title** (required; only one Title in the database) |
| **Authors** | Text |
| **Year** | Text |
| **Study Design** | Text |
| **Population/Setting** | Text |
| **Sample Size (N)** | Text |
| **Mean Age (SD)** | Text |
| **Gender Breakdown** | Text |
| **Inclusion Criteria** | Text |
| **Exclusion Criteria** | Text |
| **Recruitment Method** | Text |
| **Intervention Name** | Text |
| **Intervention Description** | Text |
| **Intervention Frequency** | Text |
| **Intervention Duration** | Text |
| **Delivery Mode** | **Select** (options: `paper`, `app`, `online`, `other`) |
| **Comparator/Control** | Text |
| **Adherence/Fidelity Monitoring** | Text |
| **Primary Outcomes** | Text |
| **Secondary Outcomes** | Text |
| **Outcome Measures/Scales** | Text |
| **Assessment Timepoints (baseline, post, follow-up)** | Text |
| **Statistical Analyses** | Text |
| **Effect Sizes (with CI)** | Text |
| **Mediators Tested** | Text |
| **Moderators Tested** | Text |
| **Main Results/Findings** | Text |
| **Strengths** | Text |
| **Limitations** | Text |
| **Authors' Stated Gaps/Future Research** | Text |
| **Practical Implications** | Text |
| **Notes/Relevance to My Study** | Text |

- **Citation** must be the **Title** type (the first column in a new database is usually Title; rename it to **Citation**).
- **Delivery Mode** must be a **Select** property with exactly these options: **paper**, **app**, **online**, **other** (the app maps extracted text to one of these).
- All other rows above (except Delivery Mode) are **Text** type.

## 4. Share the database with the integration (critical)

**This step is required.** The integration cannot see the database until you explicitly connect it.

1. Open the database in **full-page view** — click the database **title** (not the parent page) so the database is the main content.
2. In the top-right, click **•••** (three dots) or look for **Connections**.
3. Click **Add connections** or **Connections**.
4. Select your integration by name (e.g. **Literature Manager**). It must appear in the list.
5. If your integration does **not** appear: the integration was created in a different workspace. Create the integration in the same workspace where the database lives.

**Common mistake:** Sharing only the parent page does not share the database. You must open the database itself and add the connection there.

## 5. Get the database ID

1. Open the database in **full-page** view (click its title).
2. Look at the URL:  
   `https://www.notion.so/yourworkspace/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...`
3. The **database ID** is the 32-character block between the last `/` and the `?` (or end of URL). It may have hyphens; copy it as-is.  
   Example: `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6`

## 6. Configure the app

In the project root, copy `.env.example` to `.env` (if you haven’t already) and set:

```env
NOTION_API_KEY=secret_your_integration_secret_here
NOTION_DATABASE_ID=your_32_char_database_id_here
```

`NOTION_DATABASE_ID` is the **default** database used when a folder has no database configured. Restart the server after changing `.env`.

**Per-folder databases:** In the app, select a folder and click **Notion DB: Configure**. Paste that folder's Notion database ID and click Save. Each folder can point to a different database; folders without a configured ID use the `.env` default.

## How sync works

- **Save to Notion** sends **selected** papers that have **extracted data** (max 10) to your backend.
- For each paper, the app looks up an existing row by **Citation** (title, exact match).  
  - If found → that row is **updated** with the latest extraction.  
  - If not found → a **new** row is created.
- So: the same Citation (e.g. “Smith 2020”) always updates the same Notion row; re-extracting and saving again won’t create duplicates.

Preview in the app is unchanged; Notion is the main long-term store.

---

## Troubleshooting: "Could not find database"

If you get this error even with the correct ID:

1. **Re-check sharing** — Open the database in full-page view → **•••** → **Connections** → ensure your integration is listed. If not, add it.
2. **Same workspace** — The integration (from [notion.so/my-integrations](https://www.notion.so/my-integrations)) must be in the **same workspace** as the database. Check the workspace dropdown when creating/editing the integration.
3. **Re-copy the database ID** — Open the database full-page, copy the ID from the URL again (the 32-character part before `?`). Remove any extra characters.
4. **Restart the server** after changing `.env`.
