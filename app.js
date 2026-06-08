// ═══════════════════════════════════════════════════════
//  app.js — App orchestration, state, view switching
// ═══════════════════════════════════════════════════════

const APP = {

  // ── STATE ─────────────────────────────────────────
  _rows:         [],   // raw parsed rows from API
  _filteredRows: [],   // after status filter + search
  _filterStatus: 'All',
  _searchQuery:  '',
  _sortKey:      null,
  _sortDir:      1,    // 1=asc, -1=desc
  _weekFilter:   null,
  _activeView:   'overview',
  _refreshTimer: null,
  _lastSync:     null,
  _loading:      false,
  _retryCount:   0,

  // ── BOOT ──────────────────────────────────────────
  async init() {
    // Load theme preference
    const saved = localStorage.getItem('eq_theme') || CONFIG.DEFAULT_THEME;
    this.applyTheme(saved);

    // Check sheet is configured — accept SHEET_CSV_URL or SHEET_ID
    const csvOk = CONFIG.SHEET_CSV_URL && CONFIG.SHEET_CSV_URL !== 'YOUR_PUBLISHED_CSV_URL_HERE';
    const idOk  = CONFIG.SHEET_ID && CONFIG.SHEET_ID !== '' && CONFIG.SHEET_ID !== 'YOUR_GOOGLE_SHEET_ID_HERE';
    if (!csvOk && !idOk) {
      this._showConfigError();
      return;
    }

    RENDER.showSkeleton();
    await this.loadData();
    this._startRefreshLoop();
  },

  _showConfigError() {
    document.getElementById('summaryText').innerHTML =
      `⚠️ <strong>Setup required:</strong> Open <code>config.js</code> and set your <code>SHEET_ID</code>. 
       See the <em>README.md</em> for full instructions.`;
    document.getElementById('statsRow').innerHTML = '';
    document.getElementById('wsRow').innerHTML =
      `<div class="empty-state" style="padding:40px 20px">
        <div class="es-icon">⚙️</div>
        <p style="font-size:.95rem;font-weight:700;color:var(--text);margin-bottom:8px">Google Sheet not connected</p>
        <p style="max-width:380px;margin:0 auto;line-height:1.6;color:var(--muted)">
          Edit <strong>config.js</strong> and replace <code>YOUR_GOOGLE_SHEET_ID_HERE</code> 
          with your actual Sheet ID from the URL bar.<br><br>
          Then make sure your sheet is <strong>published to the web</strong> 
          (File → Share → Publish to web → Publish).
        </p>
      </div>`;
    document.getElementById('syncBadge').textContent = '⚠️ Not configured';
    document.getElementById('syncBadge').style.color = '#fca5a5';
  },

  // ── DATA LOAD ─────────────────────────────────────
  async loadData() {
    if (this._loading) return;
    this._loading = true;
    this._setSyncState('syncing');

    try {
      const rows = await API.fetchRows();
      this._rows   = rows;
      this._retryCount = 0;
      this._lastSync   = new Date();
      this._applyFilters();
      this._renderAll();
      this._setSyncState('ok');
      if (this._retryCount > 0) UTILS.toast('✅ Reconnected to Google Sheets');
    } catch (err) {
      console.error('[EQ Tracker] Fetch error:', err);
      this._retryCount++;
      this._setSyncState('error', err.message);
      if (this._rows.length === 0) this._showFetchError(err);
      UTILS.toast(`❌ Sync failed: ${err.message}`, 'error');
    } finally {
      this._loading = false;
    }
  },

  _showFetchError(err) {
    document.getElementById('wsRow').innerHTML = `
      <div class="empty-state" style="padding:40px 20px">
        <div class="es-icon">🌐</div>
        <p style="font-size:.95rem;font-weight:700;color:var(--text);margin-bottom:8px">Could not load data</p>
        <p style="max-width:380px;margin:0 auto;line-height:1.6;color:var(--muted)">${UTILS.esc(err.message)}<br><br>
          Make sure your Google Sheet is <strong>published to the web</strong> and the Sheet ID is correct.</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="APP.manualRefresh()">↺ Try Again</button>
      </div>`;
  },

  _setSyncState(state, msg = '') {
    const badge    = document.getElementById('syncBadge');
    const timeEl   = document.getElementById('lastSyncTime');
    if (state === 'syncing') {
      badge.textContent = '🔄 Syncing…';
      badge.style.color = '#93c5fd';
    } else if (state === 'ok') {
      badge.textContent = '✅ Live';
      badge.style.color = '#86efac';
      timeEl.textContent = `Updated ${UTILS.timeAgo(this._lastSync)}`;
    } else {
      badge.textContent = `⚠️ Sync error`;
      badge.style.color = '#fca5a5';
      timeEl.textContent = msg.slice(0,40);
    }
  },

  _startRefreshLoop() {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    this._refreshTimer = setInterval(() => this.loadData(), CONFIG.REFRESH_INTERVAL);
    // Update "x min ago" counter every 30s
    setInterval(() => {
      if (this._lastSync) {
        document.getElementById('lastSyncTime').textContent =
          `Updated ${UTILS.timeAgo(this._lastSync)}`;
      }
    }, 15000);
  },

  manualRefresh() {
    UTILS.toast('🔄 Refreshing…', 'success');
    this.loadData();
  },

  // ── FILTER & SORT ─────────────────────────────────
  _applyFilters() {
    let rows = [...this._rows];

    // Status filter
    if (this._filterStatus !== 'All') {
      rows = rows.filter(r => r.status === this._filterStatus);
    }

    // Week filter (for data/kanban view)
    if (this._weekFilter) {
      rows = rows.filter(r => r.weekOf === this._weekFilter);
    }

    // Search
    if (this._searchQuery) {
      rows = rows.filter(r => UTILS.matchesSearch(r, this._searchQuery));
    }

    // Sort
    if (this._sortKey) {
      rows.sort((a, b) => {
        const av = String(a[this._sortKey] || '').toLowerCase();
        const bv = String(b[this._sortKey] || '').toLowerCase();
        return av < bv ? -this._sortDir : av > bv ? this._sortDir : 0;
      });
    }

    this._filteredRows = rows;
  },

  setFilter(status, el) {
    this._filterStatus = status;
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    if (el) el.classList.add('active');
    this._applyFilters();
    this.rerender();

    // If on overview, switch to data view for filtered results
    if (this._activeView === 'overview') {
      this.showView('data', document.getElementById('nav-kanban'));
    }
  },

  onSearch(query) {
    this._searchQuery = query;
    this._applyFilters();
    this.rerender();
  },

  sortBy(key) {
    if (this._sortKey === key) {
      this._sortDir *= -1;
    } else {
      this._sortKey = key;
      this._sortDir = 1;
    }
    this._applyFilters();
    this.rerender();
  },

  filterByWeek(week, el) {
    this._weekFilter = week === this._weekFilter ? null : week;
    document.querySelectorAll('.nav-week-item').forEach(i => i.classList.remove('active'));
    if (this._weekFilter && el) el.classList.add('active');
    this._applyFilters();
    this.showView('kanban', document.getElementById('nav-kanban'));
    RENDER.renderKanban(this._filteredRows, this._weekFilter);
  },

  // ── RENDER ────────────────────────────────────────
  _renderAll() {
    RENDER.renderStats(this._rows);
    RENDER.renderSidebarNav(this._rows);
    this.rerender();
  },

  rerender() {
    if (this._activeView === 'overview') {
      RENDER.renderFlowchart(this._rows, this._filterStatus, this._searchQuery);
      RENDER.renderWeeklyAccordions(this._filteredRows);
    } else if (this._activeView === 'kanban') {
      RENDER.renderKanban(this._filteredRows, this._weekFilter);
    } else if (this._activeView === 'data') {
      RENDER.renderTable(this._filteredRows);
    }
  },

  // ── VIEW SWITCHING ────────────────────────────────
  showView(viewId, navEl) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const view = document.getElementById('view-' + viewId);
    if (view) view.classList.add('active');
    if (navEl) navEl.classList.add('active');

    this._activeView = viewId;

    // Update topbar
    const titles = { overview: 'Overview', kanban: 'Status Board', data: 'Data Table' };
    document.getElementById('topbarTitle').textContent = titles[viewId] || viewId;

    this.rerender();
  },

  showProjectDetail(idOrName) {
    const rows = this._rows.filter(r =>
      String(r.projectId) === idOrName || r.projectName === idOrName
    );
    if (!rows.length) return;

    const proj    = rows[0];
    const phases  = UTILS.calcProjectProgress(rows);

    const phaseHtml = rows.map(r => `
      <tr>
        <td>${UTILS.esc(r.task)}</td>
        <td><span class="status-pill ${UTILS.pillClass(UTILS.normalizeStatus(r.progress === 'Complete' ? 'Delivered' : r.progress === 'In progress' ? 'Active' : 'Backlog'))}">${UTILS.esc(r.progress)}</span></td>
        <td>${UTILS.esc(r.assignedTo)}</td>
        <td>${UTILS.esc(r.actionHolder)}</td>
        <td>${UTILS.esc(r.dueDate)}</td>
        <td style="font-size:.72rem;max-width:160px">${UTILS.esc(r.comments)}</td>
      </tr>`).join('');

    const modal = document.createElement('div');
    modal.id = 'projModal';
    modal.style.cssText = `
      position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,.5);backdrop-filter:blur(4px);animation:fadeIn .15s ease`;
    modal.innerHTML = `
      <style>@keyframes fadeIn{from{opacity:0}to{opacity:1}}</style>
      <div style="background:var(--card);border-radius:16px;width:min(700px,96vw);max-height:85vh;overflow-y:auto;
                  border:1px solid var(--border);box-shadow:0 20px 60px rgba(0,0,0,.35);padding:24px">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px">
          <div style="flex:1">
            <div style="font-family:'Space Grotesk',sans-serif;font-size:1.1rem;font-weight:700;color:var(--text)">${UTILS.esc(proj.projectName)}</div>
            <div style="font-size:.8rem;color:var(--muted);margin-top:3px">${UTILS.esc(proj.initiative)} · ${UTILS.esc(proj.portfolio)} · ID: ${UTILS.esc(proj.projectId)}</div>
          </div>
          <span class="status-pill ${UTILS.pillClass(UTILS.normalizeStatus(proj.statusRaw))}">${UTILS.normalizeStatus(proj.statusRaw)}</span>
          <button onclick="document.getElementById('projModal').remove()"
                  style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--muted);padding:0 4px">✕</button>
        </div>
        <div style="font-size:.8rem;color:var(--muted);margin-bottom:12px">
          Priority: <strong>${UTILS.esc(proj.priority)}</strong> &nbsp;·&nbsp;
          Week of: <strong>${UTILS.esc(proj.weekOf)}</strong>
        </div>
        <div class="table-wrap" style="margin-bottom:0">
          <table class="tracker">
            <thead><tr>
              <th>Task</th><th>Progress</th><th>Assigned To</th>
              <th>Action Holder</th><th>Due Date</th><th>Comments</th>
            </tr></thead>
            <tbody>${phaseHtml}</tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  },

  // ── EXPORT CSV ────────────────────────────────────
  exportCSV() {
    const cols = RENDER.ALL_COLS;
    const header = cols.map(c => c.label).join(',');
    const rows   = this._filteredRows.map(r =>
      cols.map(c => `"${String(r[c.key] || '').replace(/"/g,'""')}"`).join(',')
    );
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `EQ_Tracker_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    UTILS.toast('📥 CSV exported');
  },

  // ── THEME ─────────────────────────────────────────
  toggleTheme() {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    this.applyTheme(next);
    localStorage.setItem('eq_theme', next);
  },

  applyTheme(t) {
    document.body.classList.toggle('dark',  t === 'dark');
    document.body.classList.toggle('light', t === 'light');
    const label = t === 'dark' ? '☀️ Light' : '🌙 Dark';
    document.querySelectorAll('#themeBtn,#themeBtn2').forEach(b => b.textContent = label);
  },
};

// ── BOOT ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => APP.init());
