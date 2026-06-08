// ═══════════════════════════════════════════════════════
//  app.js — App orchestration, state, view switching
//  Enterprise dashboard redesign
// ═══════════════════════════════════════════════════════

const APP = {

  // ── STATE ──
  _rows:         [],
  _filteredRows: [],
  _filterStatus: 'All',
  _searchQuery:  '',
  _sortKey:      null,
  _sortDir:      1,
  _weekFilter:   null,
  _activeView:   'overview',
  _refreshTimer: null,
  _lastSync:     null,
  _loading:      false,
  _retryCount:   0,

  // ── INIT ──
  async init() {
    const saved = localStorage.getItem('eq_theme') || CONFIG.DEFAULT_THEME;
    this.applyTheme(saved);

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
    document.getElementById('summaryCard').innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-tertiary)">
        <div style="font-size:2rem;margin-bottom:16px">⚙️</div>
        <div style="font-size:1rem;font-weight:700;color:var(--text-primary);margin-bottom:8px">Setup Required</div>
        <p style="font-size:0.875rem;line-height:1.6">Open <code>config.js</code> and add your Google Sheet URL</p>
      </div>
    `;
  },

  // ── DATA LOADING ──
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
      if (this._retryCount > 0) UTILS.toast('✅ Reconnected', 'success');
    } catch (err) {
      console.error('[EQ Tracker]', err);
      this._retryCount++;
      this._setSyncState('error');
      UTILS.toast(`❌ ${err.message}`, 'error');
    } finally {
      this._loading = false;
    }
  },

  _setSyncState(state) {
    const badge = document.getElementById('syncStatus');
    const timeEl = document.getElementById('syncTime');
    const hasSpinner = state === 'syncing';

    if (state === 'syncing') {
      badge.innerHTML = '<span class="sync-spinner"></span><span>Syncing…</span>';
      badge.className = 'sync-status';
    } else if (state === 'ok') {
      badge.innerHTML = '✅ Live';
      badge.className = 'sync-status';
      timeEl.textContent = `Updated ${UTILS.timeAgo(this._lastSync)}`;
    } else {
      badge.innerHTML = '⚠️ Error';
      badge.className = 'sync-status error';
    }
  },

  _startRefreshLoop() {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    this._refreshTimer = setInterval(() => this.loadData(), CONFIG.REFRESH_INTERVAL);
    setInterval(() => {
      if (this._lastSync) {
        document.getElementById('syncTime').textContent = `Updated ${UTILS.timeAgo(this._lastSync)}`;
      }
    }, 15000);
  },

  manualRefresh() {
    UTILS.toast('🔄 Refreshing…', 'success');
    this.loadData();
  },

  // ── FILTERING & SORTING ──
  _applyFilters() {
    let rows = [...this._rows];

    if (this._filterStatus !== 'All') {
      rows = rows.filter(r => r.status === this._filterStatus);
    }

    if (this._weekFilter) {
      rows = rows.filter(r => r.weekOf === this._weekFilter);
    }

    if (this._searchQuery) {
      rows = rows.filter(r => UTILS.matchesSearch(r, this._searchQuery));
    }

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
    this.showView('kanban', null);
    RENDER.renderKanban(this._filteredRows, this._weekFilter);
  },

  // ── RENDER ──
  _renderAll() {
    RENDER.renderStats(this._rows);
    RENDER.renderSidebarNav(this._rows);
    this.rerender();
  },

  rerender() {
    if (this._activeView === 'overview') {
      RENDER.renderFlowchart(this._rows, this._filterStatus);
      RENDER.renderWeeklyAccordions(this._filteredRows);
    } else if (this._activeView === 'kanban') {
      RENDER.renderKanban(this._filteredRows, this._weekFilter);
    } else if (this._activeView === 'data') {
      RENDER.renderTable(this._filteredRows);
    }
  },

  // ── VIEW SWITCHING ──
  showView(viewId, navEl) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const view = document.getElementById('view-' + viewId);
    if (view) view.classList.add('active');
    if (navEl) navEl.classList.add('active');

    this._activeView = viewId;

    const titles = { overview: 'Dashboard', kanban: 'Kanban Board', data: 'Project Data' };
    document.getElementById('pageTitle').textContent = titles[viewId] || viewId;

    this.rerender();
  },

  showProjectDetail(idOrName) {
    const rows = this._rows.filter(r =>
      String(r.projectId) === idOrName || r.projectName === idOrName
    );
    if (!rows.length) return;

    const proj = rows[0];
    const taskRows = rows.map(r => `
      <tr>
        <td>${UTILS.esc(r.task)}</td>
        <td><span class="status-badge ${r.status.toLowerCase().replace(' ','-')}">${UTILS.esc(r.status)}</span></td>
        <td>${UTILS.esc(r.assignedTo)}</td>
        <td>${UTILS.esc(r.dueDate)}</td>
        <td style="font-size:0.8125rem">${UTILS.esc(r.comments || '—')}</td>
      </tr>
    `).join('');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">${UTILS.esc(proj.projectName)}</h2>
            <p style="font-size:0.875rem;color:var(--text-secondary);margin-top:4px">${UTILS.esc(proj.initiative)} • ${UTILS.esc(proj.portfolio)}</p>
          </div>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
            <div>
              <div style="font-size:0.8125rem;color:var(--text-tertiary);font-weight:600;margin-bottom:6px">Priority</div>
              <div style="color:var(--text-primary);font-weight:600">${UTILS.esc(proj.priority)}</div>
            </div>
            <div>
              <div style="font-size:0.8125rem;color:var(--text-tertiary);font-weight:600;margin-bottom:6px">Status</div>
              <span class="status-badge ${proj.status.toLowerCase().replace(' ','-')}">${proj.status}</span>
            </div>
          </div>
          <div style="margin-bottom:24px">
            <h3 style="font-size:1rem;font-weight:700;color:var(--text-primary);margin-bottom:12px">Tasks</h3>
            <div class="table-container">
              <div class="table-wrapper">
                <table class="data-table">
                  <thead><tr><th>Task</th><th>Status</th><th>Assigned To</th><th>Due Date</th><th>Notes</th></tr></thead>
                  <tbody>${taskRows}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  },

  // ── EXPORT ──
  exportCSV() {
    const cols = RENDER.ALL_COLS;
    const header = cols.map(c => `"${c.label}"`).join(',');
    const rows = this._filteredRows.map(r =>
      cols.map(c => `"${String(r[c.key] || '').replace(/"/g,'""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EQ_Tracker_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UTILS.toast('📥 CSV exported');
  },

  // ── THEME ──
  toggleTheme() {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    this.applyTheme(next);
    localStorage.setItem('eq_theme', next);
  },

  applyTheme(t) {
    document.body.classList.toggle('dark', t === 'dark');
    document.body.classList.toggle('light', t === 'light');
    const label = t === 'dark' ? '☀️ Light' : '🌙 Dark';
    document.querySelectorAll('#themeLabel').forEach(b => b.textContent = label);
  },
};

document.addEventListener('DOMContentLoaded', () => APP.init());
