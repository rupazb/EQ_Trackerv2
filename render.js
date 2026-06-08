// ═══════════════════════════════════════════════════════
//  render.js — All DOM generation from live data
// ═══════════════════════════════════════════════════════

const RENDER = {

  // ── STATE (set by APP before calling render fns) ──
  _colsVisible: {},
  _colPanelOpen: false,
  _weeksExpanded: false,

  ALL_COLS: [
    { key: 'projectId',    label: 'Project ID' },
    { key: 'projectName',  label: 'Project Name' },
    { key: 'initiative',   label: 'Initiative' },
    { key: 'task',         label: 'Task' },
    { key: 'weekOf',       label: 'Starting Week' },
    { key: 'priority',     label: 'Priority' },
    { key: 'dueDate',      label: 'Due Date' },
    { key: 'progress',     label: 'Progress' },
    { key: 'endDate',      label: 'End Date' },
    { key: 'assignedTo',   label: 'Assigned To' },
    { key: 'actionHolder', label: 'Action Holder' },
    { key: 'portfolio',    label: 'Portfolio' },
    { key: 'status',       label: 'Status' },
    { key: 'comments',     label: 'Comments' },
  ],

  DEFAULT_COLS: ['projectName','initiative','task','weekOf','priority','dueDate','progress','status','assignedTo','actionHolder'],

  initCols() {
    if (Object.keys(this._colsVisible).length) return;
    this.ALL_COLS.forEach(c => {
      this._colsVisible[c.key] = this.DEFAULT_COLS.includes(c.key);
    });
  },

  // ── LOADING SKELETON ──────────────────────────────
  showSkeleton() {
    const pulse = `<div style="background:linear-gradient(90deg,var(--border) 25%,var(--bg) 50%,var(--border) 75%);background-size:400% 100%;animation:shimmer 1.4s infinite;border-radius:8px;height:36px;margin-bottom:8px"></div>`;
    const style = `<style>@keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}</style>`;
    document.getElementById('wsRow').innerHTML = style + Array(6).fill(`
      <div class="ws-card notstart" style="opacity:.5">
        <div class="ws-card-header">${pulse}${pulse}</div>
      </div>`).join('');
    document.getElementById('statsRow').innerHTML = Array(5).fill(`
      <div class="stat-card" style="opacity:.4">${pulse}</div>`).join('');
  },

  // ── STATS ROW ─────────────────────────────────────
  renderStats(rows) {
    const projects = UTILS.groupByProject(rows);
    const total    = projects.length;
    const byStatus = { 'In Progress': 0, 'Blocked': 0, 'Not Started': 0, 'Complete': 0 };
    projects.forEach(p => { if (byStatus[p.status] !== undefined) byStatus[p.status]++; });

    const stats = [
      { label: 'Total Projects',  val: total,                  cls: '',        filter: 'All' },
      { label: 'In Progress',     val: byStatus['In Progress'], cls: '',        filter: 'In Progress' },
      { label: 'Blocked',         val: byStatus['Blocked'],     cls: 'red',     filter: 'Blocked' },
      { label: 'Not Started',     val: byStatus['Not Started'], cls: '',        filter: 'Not Started' },
      { label: 'Complete',        val: byStatus['Complete'],    cls: 'green',   filter: 'Complete' },
    ];

    document.getElementById('statsRow').innerHTML = stats.map(s => `
      <div class="stat-card ${s.cls}" onclick="APP.setFilter('${s.filter}',null)" title="Filter by ${s.label}">
        <div class="label">${s.label}</div>
        <div class="val">${s.val}</div>
      </div>`).join('');

    // Summary banner
    const pct = total ? Math.round((byStatus['Complete'] / total) * 100) : 0;
    document.getElementById('summaryText').innerHTML =
      `<strong>${total}</strong> projects tracked &nbsp;·&nbsp; ` +
      `<strong>${byStatus['In Progress']}</strong> active &nbsp;·&nbsp; ` +
      `<strong style="color:#fca5a5">${byStatus['Blocked']}</strong> blocked &nbsp;·&nbsp; ` +
      `<strong style="color:#86efac">${pct}%</strong> complete`;
  },

  // ── FLOWCHART (initiative cards) ──────────────────
  renderFlowchart(rows, filterStatus = 'All', searchQuery = '') {
    const filtered = rows.filter(r =>
      (filterStatus === 'All' || r.status === filterStatus) &&
      UTILS.matchesSearch(r, searchQuery)
    );

    const projects = UTILS.groupByProject(filtered);
    const wsRow    = document.getElementById('wsRow');

    if (!projects.length) {
      wsRow.innerHTML = `<div class="empty-state"><div class="es-icon">🔍</div>No projects match current filters.</div>`;
      return;
    }

    wsRow.innerHTML = projects.map(p => this._wsCard(p)).join('');
  },

  _wsCard(proj) {
    const sc     = UTILS.statusClass(proj.status);
    const dot    = UTILS.priorityDot(proj.priority);
    const phases = UTILS.calcProjectProgress(proj.tasks);

    const phaseRows = [
      { key: 'Package',    label: 'Pkg',    cls: 'pb-pkg'  },
      { key: 'Processing', label: 'Proc',   cls: 'pb-proc' },
      { key: 'Review',     label: 'Rev',    cls: 'pb-rev'  },
    ].filter(ph => phases[ph.key] !== null && phases[ph.key] !== undefined)
     .map(ph => {
       const pct = phases[ph.key];
       return `
        <div class="phase-row">
          <span class="phase-label">${ph.label}</span>
          <div class="phase-bar-wrap"><div class="phase-bar ${ph.cls}" style="width:${pct}%"></div></div>
          <span class="phase-val">${pct}%</span>
        </div>`;
     }).join('');

    const assignees = [...new Set(proj.tasks.map(t => t.assignedTo).filter(Boolean))];
    const pocTags   = assignees.slice(0,3).map(a =>
      `<span class="poc-tag">${UTILS.esc(a)}</span>`).join('');

    return `
      <div class="ws-card ${sc}" title="${UTILS.esc(proj.projectName)} — ${proj.status}"
           onclick="APP.showProjectDetail('${UTILS.esc(proj.projectId || proj.projectName)}')">
        <div class="ws-card-header">
          <div class="ws-card-name">
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UTILS.esc(proj.projectName)}</span>
            <span class="dot dot-${dot}"></span>
          </div>
          <div style="font-size:.58rem;color:var(--muted);margin-bottom:3px;font-weight:600">${UTILS.esc(proj.initiative)}</div>
          <div class="poc-row">${pocTags}</div>
        </div>
        <div class="ws-card-phases">${phaseRows || '<div style="font-size:.65rem;color:var(--muted);padding:4px 0">No task phases</div>'}</div>
        <div class="ws-card-footer">
          <span>${UTILS.esc(proj.portfolio || '')}</span>
          <strong class="${UTILS.pillClass(proj.status)}" style="font-size:.62rem;padding:2px 6px;border-radius:99px">
            ${proj.status}
          </strong>
        </div>
      </div>`;
  },

  // ── WEEKLY ACCORDIONS ─────────────────────────────
  renderWeeklyAccordions(rows) {
    const byWeek  = UTILS.groupByWeek(rows);
    const weeks   = Array.from(byWeek.keys()).filter(w => w && w !== 'unassigned');
    const container = document.getElementById('weeklyAccordions');

    container.innerHTML = weeks.map((week, i) => {
      const weekRows = byWeek.get(week);
      const projects = UTILS.groupByProject(weekRows);
      const counts   = { 'In Progress': 0, 'Blocked': 0, 'Not Started': 0, 'Complete': 0 };
      projects.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
      const meta = `${projects.length} projects · ${counts['In Progress']} active · ${counts['Blocked']} blocked`;

      return `
        <div class="weekly-accordion" id="wacc-${i}">
          <div class="weekly-acc-header" onclick="RENDER.toggleWeekAccordion(${i})">
            <span class="weekly-acc-title">📅 Week of ${UTILS.esc(week)}</span>
            <span class="weekly-acc-meta">${meta}</span>
            <span class="weekly-acc-arrow" id="warrow-${i}">▶</span>
          </div>
          <div class="weekly-acc-body" id="wbody-${i}">
            <div class="ws-row" style="justify-content:flex-start;flex-wrap:wrap;gap:10px">
              ${projects.map(p => this._wsCard(p)).join('')}
            </div>
          </div>
        </div>`;
    }).join('');
  },

  toggleWeekAccordion(i) {
    const body  = document.getElementById(`wbody-${i}`);
    const arrow = document.getElementById(`warrow-${i}`);
    const open  = body.classList.toggle('open');
    arrow.textContent = open ? '▼' : '▶';
  },

  toggleAllWeeks() {
    this._weeksExpanded = !this._weeksExpanded;
    document.querySelectorAll('.weekly-acc-body').forEach((b, i) => {
      const arrow = document.getElementById(`warrow-${i}`);
      if (this._weeksExpanded) {
        b.classList.add('open');
        if (arrow) arrow.textContent = '▼';
      } else {
        b.classList.remove('open');
        if (arrow) arrow.textContent = '▶';
      }
    });
    document.getElementById('weekAccToggle').textContent =
      this._weeksExpanded ? 'Collapse all weeks' : 'Expand all weeks';
  },

  // ── KANBAN BOARD ──────────────────────────────────
  renderKanban(rows, weekFilter = null) {
    const projects = UTILS.groupByProject(rows);
    const filtered = weekFilter
      ? projects.filter(p => p.tasks.some(t => t.weekOf === weekFilter))
      : projects;

    const cols = [
      { key: 'Not Started', cls: 'k-notstart', icon: '⏸', label: 'Not Started' },
      { key: 'In Progress', cls: 'k-inprog',   icon: '▶', label: 'In Progress' },
      { key: 'Blocked',     cls: 'k-blocked',  icon: '🚫', label: 'Blocked'     },
      { key: 'Complete',    cls: 'k-complete', icon: '✅', label: 'Complete'    },
    ];

    const board = document.getElementById('kanbanBoard');
    board.innerHTML = cols.map(col => {
      const cards = filtered.filter(p => p.status === col.key);
      return `
        <div class="kanban-col ${col.cls}" id="kc-${col.key.replace(' ','-')}"
             ondragover="event.preventDefault();this.classList.add('drag-over')"
             ondragleave="this.classList.remove('drag-over')"
             ondrop="RENDER.onKanbanDrop(event,'${col.key}')">
          <div class="kanban-col-header">
            ${col.icon} ${col.label}
            <span class="kanban-count">${cards.length}</span>
          </div>
          ${cards.map(p => this._kanbanCard(p)).join('') ||
            '<div style="color:var(--muted);font-size:.75rem;text-align:center;padding:20px 0">No projects</div>'}
        </div>`;
    }).join('');

    const monthLabel = weekFilter ? `Week of ${weekFilter}` : 'All Projects';
    document.getElementById('kanbanMonth').textContent = monthLabel;
  },

  _kanbanCard(proj) {
    const assignees = [...new Set(proj.tasks.map(t => t.assignedTo).filter(Boolean))].slice(0,2).join(', ');
    return `
      <div class="kanban-card" draggable="true"
           ondragstart="RENDER.onKanbanDragStart(event,'${UTILS.esc(proj.projectId || proj.projectName)}')"
           onclick="APP.showProjectDetail('${UTILS.esc(proj.projectId || proj.projectName)}')">
        <div class="kanban-card-name">${UTILS.esc(proj.projectName)}</div>
        <div class="kanban-card-meta">
          ${UTILS.esc(proj.initiative)}
          ${assignees ? ' · ' + UTILS.esc(assignees) : ''}
        </div>
        <div class="kanban-card-meta" style="margin-top:4px">
          <span class="status-pill ${UTILS.pillClass(proj.status)}" style="font-size:.6rem">${proj.status}</span>
          ${proj.portfolio ? `<span style="margin-left:6px;font-size:.66rem;color:var(--muted)">${UTILS.esc(proj.portfolio)}</span>` : ''}
        </div>
      </div>`;
  },

  _dragId: null,
  onKanbanDragStart(e, id) {
    this._dragId = id;
    e.dataTransfer.effectAllowed = 'move';
  },
  onKanbanDrop(e, newStatus) {
    e.currentTarget.classList.remove('drag-over');
    UTILS.toast(`Drag-and-drop is view-only. Edit status in Google Sheets to persist.`, 'warn');
  },

  // ── DATA TABLE ────────────────────────────────────
  renderTable(rows) {
    this.initCols();
    const visCols = this.ALL_COLS.filter(c => this._colsVisible[c.key]);

    // Header
    document.getElementById('headerRow').innerHTML = visCols.map(c =>
      `<th onclick="APP.sortBy('${c.key}')">
         <div class="th-inner">${c.label} <span style="opacity:.5;font-size:.65rem">↕</span></div>
       </th>`
    ).join('');

    // Body
    const tbody = document.getElementById('tableBody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${visCols.length}" class="empty-state">
        <div class="es-icon">📭</div>No rows match current filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      return `<tr>` + visCols.map(c => {
        if (c.key === 'status') {
          return `<td><span class="status-pill ${UTILS.pillClass(r.status)}">${UTILS.esc(r.status)}</span></td>`;
        }
        if (c.key === 'progress') {
          const pct = UTILS.progressToPercent(r.progress);
          return `<td>
            <div style="display:flex;align-items:center;gap:6px;justify-content:center">
              <div style="width:50px;background:var(--border);border-radius:99px;height:5px;flex-shrink:0">
                <div style="width:${pct}%;height:100%;background:${pct===100?'var(--green)':pct>0?'var(--blue-lt)':'var(--border)'};border-radius:99px;transition:.3s"></div>
              </div>
              <span style="font-size:.7rem;font-weight:600">${pct}%</span>
            </div></td>`;
        }
        return `<td>${UTILS.esc(r[c.key] || '—')}</td>`;
      }).join('') + `</tr>`;
    }).join('');
  },

  // ── COLUMN TOGGLE PANEL ───────────────────────────
  renderColPanel() {
    const panel = document.getElementById('colTogglePanel');
    panel.innerHTML = `<div class="col-toggle-title">Toggle Columns</div>` +
      this.ALL_COLS.map(c => `
        <label class="col-toggle-item">
          <input type="checkbox" ${this._colsVisible[c.key] ? 'checked' : ''}
                 onchange="RENDER.toggleCol('${c.key}',this.checked)">
          ${c.label}
        </label>`).join('');
  },

  toggleCol(key, visible) {
    this._colsVisible[key] = visible;
    APP.rerender();
  },

  toggleColPanel() {
    this._colPanelOpen = !this._colPanelOpen;
    const panel = document.getElementById('colTogglePanel');
    if (this._colPanelOpen) {
      this.renderColPanel();
      panel.classList.add('open');
      // Close when clicking outside
      setTimeout(() => {
        document.addEventListener('click', function closer(e) {
          if (!panel.contains(e.target)) {
            panel.classList.remove('open');
            RENDER._colPanelOpen = false;
            document.removeEventListener('click', closer);
          }
        });
      }, 10);
    } else {
      panel.classList.remove('open');
    }
  },

  // ── SIDEBAR MONTH/WEEK NAV ────────────────────────
  renderSidebarNav(rows) {
    const byWeek    = UTILS.groupByWeek(rows);
    const weeks     = Array.from(byWeek.keys()).filter(w => w && w !== 'unassigned');
    const container = document.getElementById('monthNav');

    // Group by month (approximate from week label text)
    const grouped = {};
    weeks.forEach(w => {
      const month = this._extractMonth(w);
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(w);
    });

    container.innerHTML = Object.entries(grouped).map(([month, weekList], mi) => `
      <div class="nav-month-group">
        <div class="nav-month-toggle" id="mnt-${mi}" onclick="RENDER.toggleMonthGroup(${mi})">
          <span class="nav-icon">📅</span>
          <span>${month}</span>
          <span class="arrow">▶</span>
        </div>
        <div class="nav-month-weeks" id="mnw-${mi}">
          ${weekList.map(w => `
            <div class="nav-week-item" onclick="APP.filterByWeek('${UTILS.esc(w)}',this)">
              Wk of ${UTILS.esc(w)}
            </div>`).join('')}
        </div>
      </div>`).join('');
  },

  _extractMonth(weekStr) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (const m of months) {
      if (weekStr.toLowerCase().includes(m.toLowerCase())) return m + ' 2026';
    }
    if (weekStr === 'historic') return 'Historic';
    return 'Other';
  },

  toggleMonthGroup(i) {
    const toggle = document.getElementById(`mnt-${i}`);
    const weeks  = document.getElementById(`mnw-${i}`);
    const open   = weeks.classList.toggle('open');
    toggle.classList.toggle('open', open);
  },
};
