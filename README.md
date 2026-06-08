# EQ Project Tracker — Live Dashboard

A live, Google Sheets–backed project tracking dashboard for GC + EQ Initiatives.
Updates automatically every 30 seconds whenever the source sheet changes.

---

## File Structure

```
eq-dashboard/
├── index.html      ← Main UI
├── config.js       ← ⚡ YOUR SETTINGS GO HERE
├── utils.js        ← Pure helper functions
├── api.js          ← Google Sheets fetch layer
├── render.js       ← All DOM rendering logic
├── app.js          ← App state + view orchestration
├── apps-script.gs  ← (Optional) Google Apps Script web app
└── README.md       ← This file
```

---

## Quick Setup (5 minutes)

### Step 1 — Prepare your Google Sheet

1. Open your Google Sheet in a browser.
2. Copy the **Sheet ID** from the URL bar:
   ```
   https://docs.google.com/spreadsheets/d/  ← COPY THIS PART →  /edit
   ```
   Example: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`

3. Make sure your sheet tab is named exactly: **`Project Management`**
   (or update `SHEET_NAME` in `config.js` to match your tab name)

### Step 2 — Publish the Sheet

> **Required for Opensheet API (the default method)**

1. In Google Sheets: **File → Share → Publish to web**
2. Select your `Project Management` sheet
3. Choose **Comma-separated values (.csv)** format
4. Click **Publish** → Confirm

### Step 3 — Configure the dashboard

Open `config.js` and replace the placeholder:

```js
SHEET_ID: 'YOUR_GOOGLE_SHEET_ID_HERE',
// ↑ Replace with your actual Sheet ID from Step 1
```

Also confirm:
```js
SHEET_NAME: 'Project Management',  // Must match your tab name exactly
```

### Step 4 — Open the dashboard

Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).

> **Note for local file access:** If you see CORS errors, use a local server:
> ```bash
> # Option A: Python
> python3 -m http.server 8080
> # Then open http://localhost:8080
>
> # Option B: Node.js
> npx serve .
> ```

---

## Column Mapping

Your Google Sheet should have these column headers (case-sensitive):

| Column Header       | Used For                              |
|---------------------|---------------------------------------|
| `Project ID`        | Unique project identifier             |
| `Project Name`      | Display name on cards                 |
| `Initiative`        | Initiative/workstream grouping        |
| `Tasks`             | Task type: Package / Processing / Review |
| `Starting week of`  | Week label for grouping               |
| `Priority`          | Priority level (1. Very High, etc.)   |
| `Due Date`          | Target completion date                |
| `Progress`          | Yet to start / In progress / Complete |
| `End Date`          | Actual completion date                |
| `Assigned to`       | Person responsible                    |
| `Action Holder`     | GreenCollar or Equilibrium            |
| `Comments`          | Free text notes                       |
| `Portfolio`         | Portfolio/region (NSW, WA/SA, etc.)   |
| `Status`            | Active / Backlog / Blocked / Delivered |

> If any column names differ, update `CONFIG.COLUMNS` in `config.js`.

---

## Optional: Google Apps Script (Private Sheets)

If your sheet is **not published publicly**, use the Apps Script method instead:

### Set up the Web App

1. In Google Sheets: **Extensions → Apps Script**
2. Replace all content with the code from `apps-script.gs` in this folder
3. Click **Deploy → New deployment**
4. Type: **Web app**
5. Execute as: **Me**
6. Who has access: **Anyone**  ← Required for the dashboard to fetch it
7. Click **Deploy** → Copy the web app URL

### Configure dashboard to use Apps Script

In `config.js`:
```js
USE_APPS_SCRIPT: true,
APPS_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
```

---

## Deploying to GitHub Pages

1. Push all files to a GitHub repository
2. Go to **Settings → Pages**
3. Source: **Deploy from branch** → `main` → `/ (root)`
4. Your dashboard will be live at `https://yourusername.github.io/your-repo/`

## Deploying to Vercel

```bash
npm install -g vercel
cd eq-dashboard
vercel --prod
```

---

## How Status Mapping Works

Google Sheet `Status` column → Dashboard kanban column:

| Sheet value | Dashboard column |
|-------------|-----------------|
| Active      | In Progress     |
| Blocked     | Blocked         |
| Backlog     | Not Started     |
| Delivered   | Complete        |

---

## Auto-Refresh

The dashboard fetches fresh data every **30 seconds** by default.
To change this, edit `config.js`:
```js
REFRESH_INTERVAL: 30000,  // milliseconds (30000 = 30 seconds)
```

---

## Troubleshooting

**"Could not load data" error**
- Check that your Sheet ID is correct
- Check that the sheet is published to the web (Step 2)
- Check the browser console for the exact error

**Data looks stale**
- Click the **↺ Refresh** button in the top bar
- Check your internet connection

**Columns missing from table**
- Click **☰ Columns** in the Data Table view to toggle columns on/off

**Wrong sheet tab**
- Update `SHEET_NAME` in `config.js` to match your exact tab name
