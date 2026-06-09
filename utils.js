// ═══════════════════════════════════════════════════════
//  utils.js — Utility functions
//  Enterprise dashboard redesign
// ═══════════════════════════════════════════════════════

const UTILS = {

  // ── ESCAPING ──
  esc(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  },

  // ── DATE FORMATTING ──
  formatDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr; // Return as-is if invalid
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch (e) {
      return dateStr;
    }
  },

  // ── STATUS NORMALIZATION ──
  normalizeStatus(status) {
    if (!status) return 'Not Started';
    const map = CONFIG.STATUS_MAP || {};
    const normalized = map[status.trim()];
    if (normalized) return normalized;
    
    // Fallback mapping
    const s = status.toLowerCase().trim();
    if (s === 'active' || s === 'in progress') return 'In Progress';
    if (s === 'blocked') return 'Blocked';
    if (s === 'backlog' || s === 'not started' || s === 'yet to start') return 'Not Started';
    if (s === 'delivered' || s === 'complete' || s === 'completed') return 'Complete';
    return 'Not Started';
  },

  // ── GROUPING ──
  groupByProject(rows) {
    const map = new Map();
    rows.forEach(r => {
      const key = r.projectName || r.projectId || 'Unknown';
      if (!map.has(key)) {
        const first = rows.find(x => x.projectName === key || x.projectId === key);
        map.set(key, {
          projectId: r.projectId,
          projectName: r.projectName,
          initiative: r.initiative,
          portfolio: r.portfolio,
          // project-level status will be computed from task statuses (see below)
          status: r.status,
          tasks: []
        });
      }
      const proj = map.get(key);
      proj.tasks.push(r);

      // Derive a project-level status based on task statuses with priority:
      // Blocked > In Progress > Not Started > Complete
      const priority = { 'Blocked': 4, 'In Progress': 3, 'Not Started': 2, 'Complete': 1 };
      const current = proj.status || 'Not Started';
      const better = (s) => priority[s] ? priority[s] : 0;
      // If the incoming task status has higher priority, update project status
      if (better(r.status) > better(current)) {
        proj.status = r.status;
      }
    });
    return Array.from(map.values());
  },

  groupByWeek(rows) {
    const map = new Map();
    rows.forEach(r => {
      const week = r.weekOf || 'Unassigned';
      if (!map.has(week)) map.set(week, []);
      map.get(week).push(r);
    });
    return map;
  },

  // ── PROGRESS ──
  progressToPercent(progress) {
    if (!progress) return 0;
    const pct = CONFIG.PROGRESS_MAP[progress];
    return pct !== undefined ? pct : 0;
  },

  // ── PROJECT PROGRESS CALC ──
  calcProjectProgress(tasks) {
    const phases = { pkg: null, proc: null, rev: null };
    tasks.forEach(t => {
      const task = (t.task || '').toLowerCase();
      const pct = this.progressToPercent(t.progress);
      if (task.includes('package')) phases.pkg = pct;
      if (task.includes('process') || task.includes('processing')) phases.proc = pct;
      if (task.includes('review')) phases.rev = pct;
    });
    return phases;
  },

  // ── TIME AGO ──
  timeAgo(date) {
    if (!date) return 'never';
    const sec = (Date.now() - date.getTime()) / 1000;
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
  },

  // ── SEARCH ──
  matchesSearch(row, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const fields = [
      row.projectName,
      row.initiative,
      row.portfolio,
      row.assignedTo,
      row.actionHolder,
      row.comments
    ];
    return fields.some(f => String(f || '').toLowerCase().includes(q));
  },

  // ── TOAST ──
  toast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      z-index: 2000;
      animation: slideIn 0.3s ease;
      backdrop-filter: blur(10px);
    `;
    if (type === 'success') {
      toast.style.background = 'rgba(22, 163, 74, 0.9)';
      toast.style.color = 'white';
    } else if (type === 'error') {
      toast.style.background = 'rgba(220, 38, 38, 0.9)';
      toast.style.color = 'white';
    } else {
      toast.style.background = 'rgba(37, 99, 235, 0.9)';
      toast.style.color = 'white';
    }
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
};
