// ═══════════════════════════════════════════════════════
//  render.js — All DOM generation from live data
//  Enterprise dashboard redesign
// ═══════════════════════════════════════════════════════

const RENDER = {

  // ── STATE ──
  _colsVisible: {},
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

  DEFAULT_COLS: ['projectName','initiative','task','weekOf','priority','dueDate','progress','status','assignedTo'],

  initCols() {
    if (Object.keys(this._colsVisible).length) return;
    this.ALL_COLS.forEach(c => {
      this._colsVisible[c.key] = this.DEFAULT_COLS.includes(c.key);
    });
  },

  // ── SKELETON LOADING ──
  showSkeleton() {
    const shimmerBox = 'style="height:60px;background:var(--border-color);border-radius:8px;margin-bottom:12px;animation:shimmer 1.5s infinite"';
    document.getElementById('summaryCard').innerHTML = `<div ${shimmerBox}></div>`;
    document.getElementById('kpiGrid').innerHTML = Array(5).fill(`<div class="kpi-card"><div class="shimmer" style="height:100px"></div></div>`).join('');
    document.getElementById('projectGrid').innerHTML = Array(6).fill(`<div class="project-card"><div class="shimmer" style="height:200px"></div></div>`).join('');
  },

  // ── SUMMARY STATS ──
  renderStats(rows) {
    const projects = UTILS.groupByProject(rows);
    const total    = projects.length;
    const byStatus = { 'In Progress': 0, 'Blocked': 0, 'Not Started': 0, 'Complete': 0 };
    projects.forEach(p => { if (byStatus[p.status] !== undefined) byStatus[p.status]++; });

    const pct = total ? Math.round((byStatus['Complete'] / total) * 100) : 0;
    const html = `
      <div class="summary-stat">
        <span class="summary-stat-value">${total}</span>
        <span class="summary-stat-label">Total Projects</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value">${byStatus['In Progress']}</span>
        <span class="summary-stat-label">Active</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value">${byStatus['Blocked']}</span>
        <span class="summary-stat-label">Blocked</span>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-value">${pct}%</span>
        <span class="summary-stat-label">Complete</span>
      </div>
    `;
    document.getElementById('summaryStats').innerHTML = html;

    // Render KPI cards
    const kpiData = [
      { label: 'Total Projects', value: total, type: 'info' },
      { label: 'In Progress', value: byStatus['In Progress'], type: 'active' },
      { label: 'Blocked', value: byStatus['Blocked'], type: 'error' },
      { label: 'Not Started', value: byStatus['Not Started'], type: 'pending' },
      { label: 'Complete', value: byStatus['Complete'], type: 'success' },
    ];

    document.getElementById('kpiGrid').innerHTML = kpiData.map((kpi, idx) => `
      <div class="kpi-card ${kpi.type}" onclick="APP.setFilter('${kpi.label}',document.querySelectorAll('.filter-pill')[${idx+1}])" style="cursor:pointer">
        <div class="kpi-label">${kpi.label}</div>
        <div class="kpi-value">${kpi.value}</div>
        <div class="kpi-meta">projects</div>
      </div>
    `).join('');

    document.getElementById('projectCount').textContent = `${projects.length} projects`;
  },

  // ── PROJECT CARDS ──
  renderFlowchart(rows, filterStatus = 'All') {
    const filtered = rows.filter(r => filterStatus === 'All' || r.status === filterStatus);
    const projects = UTILS.groupByProject(filtered);
    const grid = document.getElementById('projectGrid');

    if (!projects.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px">
          <div style="font-size:3rem;margin-bottom:16px">🔍</div>
          <div style="font-size:1rem;font-weight:700;color:var(--text-primary);margin-bottom:8px">No projects found</div>
          <div style="font-size:0.875rem;color:var(--text-tertiary)">Try adjusting your filters</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = projects.map(p => this._projectCard(p)).join('');
  },

  _projectCard(proj) {
    const phases = UTILS.calcProjectProgress(proj.tasks);
    const statusMap = { 'In Progress': 'active', 'Blocked': 'blocked', 'Not Started': 'pending', 'Complete': 'complete' };
    const statusClass = statusMap[proj.status] || 'pending';

    // Calculate average progress
    const progressValues = Object.values(phases).filter(v => v !== null);
    const avgProgress = progressValues.length ? Math.round(progressValues.reduce((a,b) => a+b) / progressValues.length) : 0;

    return `
      <div class="project-card" onclick="APP.showProjectDetail('${UTILS.esc(proj.projectId || proj.projectName)}'" style="cursor:pointer">
        <div class="project-card-header">
          <div class="project-card-title">${UTILS.esc(proj.projectName)}</div>
          <div class="project-card-meta">
            <span>${UTILS.esc(proj.initiative)}</span>
            <span>•</span>
            <span>${UTILS.esc(proj.portfolio || '—')}</span>
          </div>
        </div>
        <div class="project-card-body">
          <div class="project-card-row">
            <div>
              <div class="project-card-label">Overall Progress</div>
              <div class="progress-bar" style="margin-top:6px">
                <div class="progress-fill" style="width:${avgProgress}%"></div>
              </div>
            </div>
            <div class="project-card-value">${avgProgress}%</div>
          </div>
          <div class="project-card-row" style="justify-content:space-between">
            <span class="project-card-label">Status</span>
            <span class="status-badge ${statusClass}">${proj.status}</span>
          </div>
          <div class="project-card-row" style="justify-content:space-between">
            <span class="project-card-label">Due Date</span>
            <span class="project-card-value">${UTILS.esc(proj.tasks[0]?.dueDate || '—')}</span>
          </div>
        </div>
      </div>
    `;
  },

  // ── WEEKLY BREAKDOWN ──
  renderWeeklyAccordions(rows) {
    const byWeek = UTILS.groupByWeek(rows);
    const weeks = Array.from(byWeek.keys()).filter(w => w && w !== 'unassigned');
    const container = document.getElementById('weeklyBreakdown');

    if (!weeks.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">No weeks available</div></div>`;
      return;
    }

    container.innerHTML = weeks.map((week, i) => {
      const weekRows = byWeek.get(week);
      const projects = UTILS.groupByProject(weekRows);
      const counts = { 'In Progress': 0, 'Blocked': 0, 'Not Started': 0, 'Complete': 0 };
      projects.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });

      return `
        <div style="margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-secondary);border-radius:8px;cursor:pointer" onclick="RENDER.toggleWeek(${i})" id="week-toggle-${i}">
            <span style="font-size:1rem">📅</span>
            <div style="flex:1">
              <div style="font-weight:700;color:var(--text-primary)">Week of ${UTILS.esc(week)}</div>
              <div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:2px">${projects.length} projects • ${counts['In Progress']} active • ${counts['Blocked']} blocked</div>
            </div>
            <span id="week-arrow-${i}" style="font-size:0.8rem;color:var(--text-tertiary)">▶</span>
          </div>
          <div id="week-body-${i}" style="display:none;margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
            ${projects.map(p => this._projectCard(p)).join('')}
          </div>
        </div>
      `;
    }).join('');
  },

  toggleWeek(i) {
    const body = document.getElementById(`week-body-${i}`);
    const arrow = document.getElementById(`week-arrow-${i}`);
    const isOpen = body.style.display === 'grid';
    body.style.display = isOpen ? 'none' : 'grid';
    arrow.textContent = isOpen ? '▶' : '▼';
  },

  toggleAllWeeks() {
    this._weeksExpanded = !this._weeksExpanded;
    document.querySelectorAll('[id^="week-body-"]').forEach((b, i) => {
      const arrow = document.getElementById(`week-arrow-${i}`);
      if (this._weeksExpanded) {
        b.style.display = 'grid';
        if (arrow) arrow.textContent = '▼';
      } else {
        b.style.display = 'none';
        if (arrow) arrow.textContent = '▶';
      }
    });
    document.getElementById('weekToggleBtn').textContent = this._weeksExpanded ? 'Collapse all' : 'Expand all';
  },

  // ── KANBAN BOARD ──
  renderKanban(rows, weekFilter = null) {
    const projects = UTILS.groupByProject(rows);
    const filtered = weekFilter
      ? projects.filter(p => p.tasks.some(t => t.weekOf === weekFilter))
      : projects;

    const cols = [
      { key: 'Not Started', label: 'Not Started', icon: '⏸', color: 'pending' },
      { key: 'In Progress', label: 'In Progress', icon: '▶', color: 'active' },
      { key: 'Blocked',     label: 'Blocked',     icon: '🚫', color: 'blocked' },
      { key: 'Complete',    label: 'Complete',    icon: '✅', color: 'complete' },
    ];

    const board = document.getElementById('kanbanBoard');
    board.innerHTML = cols.map(col => {
      const cards = filtered.filter(p => p.status === col.key);
      return `
        <div class="kanban-column">
          <div class="kanban-header">
            <div class="kanban-title">
              <span>${col.icon}</span>
              <span>${col.label}</span>
            </div>
            <div class="kanban-count">${cards.length}</div>
          </div>
          <div class="kanban-items">
            ${cards.map(p => this._kanbanCard(p)).join('') || '<div style="color:var(--text-tertiary);font-size:0.875rem;text-align:center;padding:20px 0">No projects</div>'}
          </div>
        </div>
      `;
    }).join('');

    const monthLabel = weekFilter ? `Week of ${weekFilter}` : 'All Projects';
    document.getElementById('kanbanMonth').textContent = monthLabel;
  },

  _kanbanCard(proj) {
    const statusMap = { 'In Progress': 'active', 'Blocked': 'blocked', 'Not Started': 'pending', 'Complete': 'complete' };
    const statusClass = statusMap[proj.status] || 'pending';
    const assignees = [...new Set(proj.tasks.map(t => t.assignedTo).filter(Boolean))].slice(0,2).join(', ');

    return `
      <div class="kanban-card" onclick="APP.showProjectDetail('${UTILS.esc(proj.projectId || proj.projectName)}'" style="cursor:pointer">
        <div class="kanban-card-title">${UTILS.esc(proj.projectName)}</div>
        <div class="kanban-card-meta">${UTILS.esc(proj.initiative)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
          <span class="status-badge ${statusClass}">${proj.status}</span>
          ${assignees ? `<span style="font-size:0.75rem;color:var(--text-tertiary)">${UTILS.esc(assignees)}</span>` : ''}
        </div>
      </div>
    `;
  },

  // ── DATA TABLE ──
  renderTable(rows) {
    this.initCols();
    const visCols = this.ALL_COLS.filter(c => this._colsVisible[c.key]);

    // Header
    document.getElementById('headerRow').innerHTML = visCols.map(c =>
      `<th onclick="APP.sortBy('${c.key}')" style="cursor:pointer">${c.label} <span style="opacity:0.5;font-size:0.75rem">↕</span></th>`
    ).join('');

    // Body
    const tbody = document.getElementById('tableBody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${visCols.length}" style="text-align:center;padding:40px 20px;color:var(--text-tertiary)">No projects match current filters</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      return `<tr>` + visCols.map(c => {
        if (c.key === 'status') {
          const statusMap = { 'In Progress': 'active', 'Blocked': 'blocked', 'Not Started': 'pending', 'Complete': 'complete' };
          return `<td><span class="status-badge ${statusMap[r.status] || 'pending'}">${UTILS.esc(r.status)}</span></td>`;
        }
        if (c.key === 'progress') {
          const pct = UTILS.progressToPercent(r.progress);
          return `<td><div style="display:flex;align-items:center;gap:8px"><div style="width:60px;height:4px;background:var(--border-color);border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--blue)"></div></div><span style="font-size:0.75rem;font-weight:700">${pct}%</span></div></td>`;
        }
        return `<td>${UTILS.esc(r[c.key] || '—')}</td>`;
      }).join('') + `</tr>`;
    }).join('');
  },

  // ── SIDEBAR NAV ──
  renderSidebarNav(rows) {
    const byWeek = UTILS.groupByWeek(rows);
    const weeks = Array.from(byWeek.keys()).filter(w => w && w !== 'unassigned');
    const container = document.getElementById('monthNav');

    const grouped = {};
    weeks.forEach(w => {
      const month = this._extractMonth(w);
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(w);
    });

    container.innerHTML = Object.entries(grouped).map(([month, weekList], mi) => `
      <div class="nav-month-group">
        <div class="nav-month-toggle" onclick="RENDER.toggleMonthGroup(${mi})" id="mnt-${mi}">
          <span class="nav-icon">📅</span>
          <span>${month}</span>
          <span class="arrow">▶</span>
        </div>
        <div class="nav-month-weeks" id="mnw-${mi}">
          ${weekList.map(w => `<div class="nav-week-item" onclick="APP.filterByWeek('${UTILS.esc(w)}',this)">Wk ${UTILS.esc(w.slice(0,10))}</div>`).join('')}
        </div>
      </div>
    `).join('');
  },

  _extractMonth(weekStr) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (const m of months) {
      if (weekStr.toLowerCase().includes(m.toLowerCase())) return m + ' 2026';
    }
    return 'Other';
  },

  toggleMonthGroup(i) {
    const toggle = document.getElementById(`mnt-${i}`);
    const weeks = document.getElementById(`mnw-${i}`);
    const isOpen = weeks.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
  },
};
