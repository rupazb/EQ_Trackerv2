// ═══════════════════════════════════════════════════════
//  api.js — Google Sheets data fetching & row parsing
// ═══════════════════════════════════════════════════════

const API = {

  // ── FETCH ENTRY POINT ─────────────────────────────
  async fetchRows() {
    if (CONFIG.USE_APPS_SCRIPT && CONFIG.APPS_SCRIPT_URL) {
      return await this._fetchAppsScript();
    }
    return await this._fetchOpensheet();
  },

  // ── OPENSHEET (public sheets, no auth needed) ─────
  // Requires the Google Sheet to be published to the web (File → Share → Publish to web)
  async _fetchOpensheet() {
    const sheetEncoded = encodeURIComponent(CONFIG.SHEET_NAME);
    const url = `https://opensheet.elk.sh/${CONFIG.SHEET_ID}/${sheetEncoded}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Opensheet HTTP ${res.status}: ${res.statusText}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('Unexpected response format from Opensheet');
    return this._parseRows(json);
  },

  // ── APPS SCRIPT (private sheets, needs web app) ───
  async _fetchAppsScript() {
    const url = `${CONFIG.APPS_SCRIPT_URL}?sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
    const json = await res.json();
    const rows = json.data || json.rows || json;
    if (!Array.isArray(rows)) throw new Error('Unexpected response from Apps Script');
    return this._parseRows(rows);
  },

  // ── ROW NORMALIZER ────────────────────────────────
  // Maps raw header strings → clean internal field names
  _parseRows(rawRows) {
    const C = CONFIG.COLUMNS;
    return rawRows
      .filter(r => {
        // Skip entirely empty rows or template rows
        const name = r[C.PROJECT_NAME] || r['Project Name'] || '';
        const id   = r[C.PROJECT_ID]   || r['Project ID']   || '';
        return name.trim() !== '' || id.toString().trim() !== '';
      })
      .map((r, idx) => {
        const raw = (col) => {
          // Try exact match, then try CONFIG.COLUMNS lookup
          if (r[col] !== undefined) return r[col];
          // Fallback: case-insensitive search
          const k = Object.keys(r).find(k => k.toLowerCase() === col.toLowerCase());
          return k ? r[k] : '';
        };

        const progressRaw   = raw(C.PROGRESS)      || raw('Progress')       || '';
        const statusRaw     = raw(C.STATUS)         || raw('Status')         || '';
        const taskRaw       = raw(C.TASKS)          || raw('Tasks')          || raw('Task') || '';
        const assignedRaw   = raw(C.ASSIGNED_TO)    || raw('Assigned to')    || raw('Assigned To') || '';
        const actionRaw     = raw(C.ACTION_HOLDER)  || raw('Action Holder')  || '';
        const portfolioRaw  = raw(C.PORTFOLIO)      || raw('Portfolio')      || '';
        const weekOfRaw     = raw(C.WEEK_OF)        || raw('Starting week of') || '';
        const priorityRaw   = raw(C.PRIORITY)       || raw('Priority')       || '';
        const initiativeRaw = raw(C.INITIATIVE)     || raw('Initiative')     || '';
        const projectId     = raw(C.PROJECT_ID)     || raw('Project ID')     || '';
        const projectName   = raw(C.PROJECT_NAME)   || raw('Project Name')   || '';
        const dueDateRaw    = raw(C.DUE_DATE)        || raw('Due Date')       || '';
        const endDateRaw    = raw(C.END_DATE)        || raw('End Date')       || '';
        const commentsRaw   = raw(C.COMMENTS)        || raw('Comments')       || '';

        const normalizedStatus = UTILS.normalizeStatus(statusRaw);

        return {
          _idx:        idx,
          projectId:   String(projectId).trim(),
          projectName: String(projectName).trim(),
          initiative:  String(initiativeRaw).trim(),
          task:        String(taskRaw).trim(),          // Package / Processing / Review / Other
          weekOf:      String(weekOfRaw).trim(),
          priority:    String(priorityRaw).trim(),
          dueDate:     UTILS.formatDate(dueDateRaw),
          progress:    String(progressRaw).trim(),
          endDate:     UTILS.formatDate(endDateRaw),
          assignedTo:  String(assignedRaw).trim(),
          actionHolder: String(actionRaw).trim(),
          comments:    String(commentsRaw).trim(),
          portfolio:   String(portfolioRaw).trim(),
          statusRaw:   String(statusRaw).trim(),
          status:      normalizedStatus,
        };
      });
  },
};
