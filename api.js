// ═══════════════════════════════════════════════════════
//  api.js — Google Sheets data fetching & row parsing
//
//  Supports three fetch methods (tried in order):
//    1. Direct CSV URL  (SHEET_CSV_URL in config.js)  ← recommended
//    2. Apps Script     (USE_APPS_SCRIPT + APPS_SCRIPT_URL)
//    3. Opensheet proxy (SHEET_ID + SHEET_NAME)       ← fallback
// ═══════════════════════════════════════════════════════

const API = {

  // ── FETCH ENTRY POINT ─────────────────────────────
  async fetchRows() {
    if (CONFIG.USE_APPS_SCRIPT && CONFIG.APPS_SCRIPT_URL) {
      return await this._fetchAppsScript();
    }
    if (CONFIG.SHEET_CSV_URL && CONFIG.SHEET_CSV_URL !== 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQj6UNpK8LqTGHXwuowg7hMqzwixKmeo9OyGhgj094DmEri17RHIbeq8sBELYqGRQ/pub?output=csv') {
      return await this._fetchCSV(CONFIG.SHEET_CSV_URL);
    }
    if (CONFIG.SHEET_ID && CONFIG.SHEET_ID !== '1YR1XHNZ2eeUu-oVJyL6uUaQoncRJ3y45') {
      // Handle case where full URL was pasted into SHEET_ID by mistake
      if (CONFIG.SHEET_ID.startsWith('http')) {
        return await this._fetchCSV(CONFIG.SHEET_ID);
      }
      return await this._fetchOpensheet();
    }
    throw new Error('No Sheet URL or ID configured. Open config.js and set SHEET_CSV_URL.');
  },

  // ── METHOD 1: Direct Google Sheets CSV URL ────────
  // Uses the URL from File → Share → Publish to web → CSV
  // No third-party service needed.
  async _fetchCSV(csvUrl) {
    // Google's published CSV URL sometimes needs a cache-bust param
    const url = csvUrl.includes('?')
      ? `${csvUrl}&cachebust=${Date.now()}`
      : `${csvUrl}?cachebust=${Date.now()}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Google Sheets CSV fetch failed (HTTP ${res.status}). ` +
      `Make sure the sheet is published to the web.`);

    const text = await res.text();
    if (!text || text.trim().length === 0) {
      throw new Error('Google Sheets returned an empty response. Check the sheet tab name and publish settings.');
    }

    const rows = this._parseCSV(text);
    return this._parseRows(rows);
  },

  // ── CSV TEXT PARSER ───────────────────────────────
  // Handles quoted fields, commas inside quotes, newlines inside quotes
  _parseCSV(text) {
    const lines = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch   = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') { cur += '"'; i++; } // escaped quote
        else inQuotes = !inQuotes;
      } else if (ch === '\n' && !inQuotes) {
        lines.push(cur);
        cur = '';
      } else if (ch === '\r' && next === '\n' && !inQuotes) {
        lines.push(cur);
        cur = '';
        i++; // skip \n
      } else {
        cur += ch;
      }
    }
    if (cur) lines.push(cur);

    // Split each line into cells
    const splitLine = (line) => {
      const cells = [];
      let cell = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c  = line[i];
        const nx = line[i + 1];
        if (c === '"') {
          if (inQ && nx === '"') { cell += '"'; i++; }
          else inQ = !inQ;
        } else if (c === ',' && !inQ) {
          cells.push(cell);
          cell = '';
        } else {
          cell += c;
        }
      }
      cells.push(cell);
      return cells;
    };

    if (!lines.length) return [];
    const headers = splitLine(lines[0]);
    const result  = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cells = splitLine(lines[i]);
      const row   = {};
      headers.forEach((h, j) => {
        row[h.trim()] = (cells[j] || '').trim();
      });
      result.push(row);
    }
    return result;
  },

  // ── METHOD 2: Google Apps Script Web App ─────────
  async _fetchAppsScript() {
    const url = `${CONFIG.APPS_SCRIPT_URL}?sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
    const json = await res.json();
    const rows = json.data || json.rows || json;
    if (!Array.isArray(rows)) throw new Error('Unexpected response from Apps Script');
    return this._parseRows(rows);
  },

  // ── METHOD 3: Opensheet Proxy (fallback) ─────────
  async _fetchOpensheet() {
    const sheetEncoded = encodeURIComponent(CONFIG.SHEET_NAME);
    const url = `https://opensheet.elk.sh/${CONFIG.SHEET_ID}/${sheetEncoded}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Opensheet HTTP ${res.status}: ${res.statusText}. ` +
      `Try using the direct CSV URL instead — see config.js.`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('Unexpected response format from Opensheet');
    return this._parseRows(json);
  },

  // ── ROW NORMALIZER ────────────────────────────────
  _parseRows(rawRows) {
    const C = CONFIG.COLUMNS;
    return rawRows
      .filter(r => {
        const name = r[C.PROJECT_NAME] || r['Project Name'] || '';
        const id   = r[C.PROJECT_ID]   || r['Project ID']   || '';
        return name.trim() !== '' || id.toString().trim() !== '';
      })
      .map((r, idx) => {
        const raw = (col) => {
          if (r[col] !== undefined && r[col] !== null) return r[col];
          const k = Object.keys(r).find(k => k.toLowerCase() === col.toLowerCase());
          return k ? r[k] : '';
        };

        // Handle the duplicate "Status" column — sheet has both a task Status and project Status
        // The second "Status" column (project-level) is what we want for kanban
        // Google Sheets CSV exports duplicate headers as "Status", "Status_1" or just "Status"
        // We grab all values and pick the most meaningful one
        const allKeys = Object.keys(r);
        const statusKeys = allKeys.filter(k => k.toLowerCase().startsWith('status'));
        let statusRaw = '';
        for (const k of statusKeys) {
          const v = String(r[k] || '').trim();
          if (['Active','Blocked','Backlog','Delivered'].includes(v)) { statusRaw = v; break; }
        }
        if (!statusRaw) statusRaw = raw(C.STATUS) || raw('Status') || '';

        const progressRaw    = raw(C.PROGRESS)     || raw('Progress')        || '';
        const taskRaw        = raw(C.TASKS)         || raw('Tasks')           || raw('Task') || '';
        const assignedRaw    = raw(C.ASSIGNED_TO)   || raw('Assigned to')     || raw('Assigned To') || '';
        const actionRaw      = raw(C.ACTION_HOLDER) || raw('Action Holder')   || '';
        const portfolioRaw   = raw(C.PORTFOLIO)     || raw('Portfolio')       || '';
        const weekOfRaw      = raw(C.WEEK_OF)       || raw('Starting week of') || '';
        const priorityRaw    = raw(C.PRIORITY)      || raw('Priority')        || '';
        const initiativeRaw  = raw(C.INITIATIVE)    || raw('Initiative')      || '';
        const projectId      = raw(C.PROJECT_ID)    || raw('Project ID')      || '';
        const projectName    = raw(C.PROJECT_NAME)  || raw('Project Name')    || '';
        const dueDateRaw     = raw(C.DUE_DATE)      || raw('Due Date')        || '';
        const endDateRaw     = raw(C.END_DATE)      || raw('End Date')        || '';
        const commentsRaw    = raw(C.COMMENTS)      || raw('Comments')        || '';

        return {
          _idx:         idx,
          projectId:    String(projectId).trim(),
          projectName:  String(projectName).trim(),
          initiative:   String(initiativeRaw).trim(),
          task:         String(taskRaw).trim(),
          weekOf:       String(weekOfRaw).trim(),
          priority:     String(priorityRaw).trim(),
          dueDate:      UTILS.formatDate(dueDateRaw),
          progress:     String(progressRaw).trim(),
          endDate:      UTILS.formatDate(endDateRaw),
          assignedTo:   String(assignedRaw).trim(),
          actionHolder: String(actionRaw).trim(),
          comments:     String(commentsRaw).trim(),
          portfolio:    String(portfolioRaw).trim(),
          statusRaw:    String(statusRaw).trim(),
          status:       UTILS.normalizeStatus(statusRaw),
        };
      });
  },
};
