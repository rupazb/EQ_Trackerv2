// ═══════════════════════════════════════════════════════
//  render.js — All DOM generation from live data
//  Enterprise dashboard redesign
// ═══════════════════════════════════════════════════════

const RENDER = {

  // ── STATE ──
  _colsVisible: {},

  ALL_COLS: [
    { key: 'projectId',    label: 'Project ID' },
    { key: 'projectName',  label: 'Project Name' },
    { key: 'initiative',   label: 'Initiative' },
    { key: 'task',         label: 'Task' },
    { key: 'weekOf',       label: 'Starting Week' },
    { key: 'priority',     label: 'Priority' },
    { key: 'dueDate',      label: 'Due Date' },
    { key: 'progress',     label: 'Progress' },
    { key: 'assignedTo',   label: 'Assigned To' },
    { key: 'status',       label: 'Status' },
    { key: 'comments',     label: 'Comments' },
  ],

  DEFAULT_COLS: ['projectName', 'initiative', 'task', 'weekOf', 'priority', 'dueDate', 'progress', 'status', 'assignedTo'],

  initCols() {
    if (Object.keys(this._colsVisible).length) return;
    this.ALL_COLS.forEach(c => {
      this._colsVisible[c.key] = this.DEFAULT_COLS.includes(c.key);
    });
  },

  // ── SKELETON LOADER ──
  showSkeleton() {
    const container = document.getElementById('kpiGrid');
    if (container) {
      container.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text-tertiary)">
          <div style="font-size:2rem;margin-bottom:16px;animation:pulse 1.5s infinite">⏳</div>
          <div style="font-size:1rem;font-weight:700;color:var(--text-primary);margin-bottom:8px">Loading data…</div>
          <p style="font-size:0.875rem">Fetching your Google Sheet</p>
        </div>
      `;
    }
  },

  // ── KPI RENDERING ──
  renderStats(rows) {
    const projects = UTILS.groupByProject(rows);
    const total = projects.length;
    const byStatus = { 'In Progress': 0, 'Blocked': 0, 'Not Started': 0, 'Complete': 0 };
    projects.forEach(p => {
      if (byStatus[p.status] !== undefined) byStatus[p.status]++;
    });

    const kpiData = [
      { label: 'Total Projects', value: total, type: 'info' },
      { label: 'In Progress', value: byStatus['In Progress'], type: 'success' },
      { label: 'Blocked', value: byStatus['Blocked'], type: 'error' },
      { label: 'Not Started', value: byStatus['Not Started'], type: 'warning' },
      { label: 'Complete', value: byStatus['Complete'], type: 'info' },
    ];

    document.getElementById('kpiGrid').innerHTML = kpiData.map((kpi, idx) => `
      <div class="kpi-card ${kpi.type}" onclick="APP.setFilter('${kpi.label}', document.querySelectorAll('.filter-pill')[${idx}])" style="cursor:pointer">
        <div class="kpi-label">${kpi.label}</div>
        <div class="kpi-value">${kpi.value}</div>
        <div class="kpi-meta">projects</div>
      </div>
    `).join('');

    document.getElementById('projectCount').textContent = `${projects.length} total`;
  },

  // ── PROJECT CARDS ──
  renderFlowchart(rows, filterStatus = 'All') {
    const filtered = rows.filter(r => filterStatus === 'All' || r.status === filterStatus);
    const projects = UTILS.groupByProject(filtered);
    const grid = document.getElementById('projectGrid');

    if (!projects.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1">
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">No projects found</div>
            <div class="empty-state-desc">Try adjusting your filters</div>
          </div>
        </div>
      `;
      return;
    }

    grid.innerHTML = projects.map(p => this._projectCard(p)).join('');
  },

  _projectCard(proj) {
    const statusMap = { 'In Progress': 'active', 'Blocked': 'blocked', 'Not Started': 'pending', 'Complete': 'complete' };
    const statusClass = statusMap[proj.status] || 'pending';

    const progressValues = proj.tasks.map(t => UTILS.progressToPercent(t.progress)).filter(v => v !== null);
    const avgProgress = progressValues.length ? Math.round(progressValues.reduce((a, b) => a + b) / progressValues.length) : 0;

    return `
      <div class="project-card" onclick="APP.showProjectDetail('${UTILS.esc(proj.projectId || proj.projectName)}')" style="cursor:pointer">
        <div class="project-card-header">
          <div class="project-card-title">${UTILS.esc(proj.projectName)}</div>
          <div class="project-card-meta">${UTILS.esc(proj.initiative)} ${proj.portfolio ? '• ' + UTILS.esc(proj.portfolio) : ''}</div>
        </div>
        <div class="project-card-body">
          <div class="project-card-row">
            <div class="project-card-label">Overall Progress</div>
            <div class="project-card-value">${avgProgress}%</div>
          </div>
          <div class="progress-bar" style="margin-bottom:8px">
            <div class="progress-fill" style="width:${avgProgress}%"></div>
          </div>
          <div class="project-card-row" style="padding-top:8px;padding-bottom:0">
            <div class="project-card-label">Status</div>
            <span class="status-badge ${statusClass}">${proj.status}</span>
          </div>
          <div class="project-card-row" style="padding-bottom:0">
            <div class="project-card-label">Due Date</div>
            <div class="project-card-value">${UTILS.esc(proj.tasks[0]?.dueDate || '—')}</div>
          </div>
        </div>
      </div>
    `;
  },

  // ── WEEKLY BREAKDOWN ──
  renderWeeklyAccordions(rows) {
    const byWeek = UTILS.groupByWeek(rows);
    const weeks = Array.from(byWeek.keys()).filter(w => w && w !== 'Unassigned');
    const container = document.getElementById('weeklyBreakdown');

    if (!weeks.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">No weeks available</div>
        </div>
      `;
      return;
    }

    container.innerHTML = weeks.map((week, i) => {
      const weekRows = byWeek.get(week);
      const projects = UTILS.groupByProject(weekRows);
      const counts = { 'In Progress': 0, 'Blocked': 0, 'Not Started': 0, 'Complete': 0 };
      projects.forEach(p => {
        if (counts[p.status] !== undefined) counts[p.status]++;
      });

      return `
        <div class="accordion-item">
          <div class="accordion-header" id="week-toggle-${i}" onclick="RENDER.toggleAccordion(this)">
            <span class="accordion-icon">▶</span>
            <div style="flex:1">
              <div style="font-weight:600;color:var(--text-primary)">Week of ${UTILS.esc(week)}</div>
              <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px">${projects.length} projects • ${counts['In Progress']} in progress • ${counts['Blocked']} blocked</div>
            </div>
          </div>
          <div class="accordion-content">
            ${projects.map(p => this._projectCard(p)).join('')}
          </div>
        </div>
      `;
    }).join('');
  },

  toggleAccordion(el) {
    el.classList.toggle('open');
  },

  // ── KANBAN BOARD ──
  renderKanban(rows, weekFilter = null) {
    const projects = UTILS.groupByProject(rows);
    const filtered = weekFilter
      ? projects.filter(p => p.tasks.some(t => t.weekOf === weekFilter))
      : projects;

    const cols = [
      { key: 'Not Started', label: 'Not Started', icon: '⏸' },
      { key: 'In Progress', label: 'In Progress', icon: '▶' },
      { key: 'Blocked', label: 'Blocked', icon: '🚫' },
      { key: 'Complete', label: 'Complete', icon: '✅' },
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
            ${cards.map(p => this._kanbanCard(p)).join('') || '<div style="color:var(--text-tertiary);font-size:12px;text-align:center;padding:20px 0">No projects</div>'}
          </div>
        </div>
      `;
    }).join('');

    const monthLabel = weekFilter ? `Week of ${weekFilter}` : 'All Projects';
    const kanbanMonth = document.getElementById('kanbanMonth');
    if (kanbanMonth) kanbanMonth.textContent = monthLabel;
  },

  _kanbanCard(proj) {
    const statusMap = { 'In Progress': 'active', 'Blocked': 'blocked', 'Not Started': 'pending', 'Complete': 'complete' };
    const statusClass = statusMap[proj.status] || 'pending';
    const assignees = [...new Set(proj.tasks.map(t => t.assignedTo).filter(Boolean))].slice(0, 2).join(', ');

    return `
      <div class="kanban-card" onclick="APP.showProjectDetail('${UTILS.esc(proj.projectId || proj.projectName)}')" style="cursor:pointer">
        <div class="kanban-card-title">${UTILS.esc(proj.projectName)}</div>
        <div class="kanban-card-meta">${UTILS.esc(proj.initiative)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
          <span class="status-badge ${statusClass}">${proj.status}</span>
          ${assignees ? `<span style="font-size:12px;color:var(--text-tertiary)">${UTILS.esc(assignees)}</span>` : ''}
        </div>
      </div>
    `;
  },

  // ── DATA TABLE ──
  renderTable(rows) {
    this.initCols();
    const visCols = this.ALL_COLS.filter(c => this._colsVisible[c.key]);

    document.getElementById('headerRow').innerHTML = visCols.map(c =>
      `<th onclick="APP.sortBy('${c.key}')" style="cursor:pointer;user-select:none">${c.label} <span style="opacity:0.5;font-size:11px">↕</span></th>`
    ).join('');

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
          return `<td><div style="display:flex;align-items:center;gap:8px"><div style="width:60px;height:4px;background:var(--border-color);border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--color-primary),#3b82f6)"></div></div><span style="font-size:12px;color:var(--text-secondary)">${pct}%</span></div></td>`;
        }
        return `<td>${UTILS.esc(r[c.key] || '—')}</td>`;
      }).join('') + `</tr>`;
    }).join('');
  },

  // ── SIDEBAR NAV ──
  renderSidebarNav(rows) {
    const byWeek = UTILS.groupByWeek(rows);
    const weeks = Array.from(byWeek.keys()).filter(w => w && w !== 'Unassigned');
    const container = document.getElementById('weekNav');

    if (!weeks.length) {
      container.innerHTML = '<div style="padding:12px 16px;font-size:12px;color:var(--text-tertiary)">No weeks scheduled</div>';
      return;
    }

    const grouped = {};
    weeks.forEach(w => {
      const month = this._extractMonth(w);
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(w);
    });

    container.innerHTML = Object.entries(grouped).map(([month, weekList], mi) => `
      <div>
        <div class="nav-item" onclick="RENDER.toggleWeekGroup(${mi})" id="week-toggle-${mi}" style="cursor:pointer;margin:4px 8px">
          <span class="nav-icon">📅</span>
          <span>${month}</span>
          <span style="margin-left:auto;font-size:11px;opacity:0.5">▶</span>
        </div>
        <div id="week-list-${mi}" style="display:none;padding-left:20px">
          ${weekList.map(w => `<div class="nav-item" onclick="APP.filterByWeek('${UTILS.esc(w)}', this)" style="cursor:pointer;padding:8px 8px;margin:2px 0">Week ${UTILS.esc(w.slice(0, 10))}</div>`).join('')}
        </div>
      </div>
    `).join('');
  },

  _extractMonth(weekStr) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (const m of months) {
      if (weekStr.toLowerCase().includes(m.toLowerCase())) return m;
    }
    return 'Other';
  },

  toggleWeekGroup(i) {
    const list = document.getElementById(`week-list-${i}`);
    const toggle = document.getElementById(`week-toggle-${i}`);
    const isOpen = list.style.display === 'block';
    list.style.display = isOpen ? 'none' : 'block';
    const arrow = toggle.querySelector('[style*="opacity"]');
    if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
  }
};
