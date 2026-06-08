// ═══════════════════════════════════════════════════════
//  utils.js — Pure helper functions (no DOM, no state)
// ═══════════════════════════════════════════════════════

const UTILS = {

  // ── STATUS NORMALIZATION ───────────────────────────
  normalizeStatus(raw) {
    if (!raw) return 'Not Started';
    const s = String(raw).trim();
    return CONFIG.STATUS_MAP[s] || (() => {
      const l = s.toLowerCase();
      if (l.includes('active'))    return 'In Progress';
      if (l.includes('block'))     return 'Blocked';
      if (l.includes('backlog') || l.includes('not start') || l.includes('yet')) return 'Not Started';
      if (l.includes('deliver') || l.includes('complete')) return 'Complete';
      return 'Not Started';
    })();
  },

  progressToPercent(raw) {
    if (raw === null || raw === undefined) return 0;
    const s = String(raw).trim();
    return CONFIG.PROGRESS_MAP[s] ?? (parseInt(s) || 0);
  },

  priorityDot(raw) {
    const s = String(raw || '').trim();
    return CONFIG.PRIORITY_DOT[s] || 'med';
  },

  statusClass(status) {
    const m = {
      'In Progress': 'inprog',
      'Blocked':     'blocked',
      'Not Started': 'notstart',
      'Complete':    'complete',
    };
    return m[status] || 'notstart';
  },

  pillClass(status) {
    const m = {
      'In Progress': 'pill-inprog',
      'Blocked':     'pill-blocked',
      'Not Started': 'pill-notstart',
      'Complete':    'pill-complete',
    };
    return m[status] || 'pill-notstart';
  },

  // ── DATE HELPERS ───────────────────────────────────
  // Excel serial date → JS Date
  serialToDate(serial) {
    if (!serial || isNaN(serial)) return null;
    const n = Number(serial);
    if (n < 100) return null; // not a real date serial
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return d;
  },

  formatDate(val) {
    if (!val || val === '-' || val === '') return '—';
    // Already a formatted string
    if (isNaN(val) && String(val).length > 4) return String(val).trim();
    const d = this.serialToDate(Number(val));
    if (!d) return String(val).trim();
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
  },

  timeAgo(date) {
    if (!date) return '';
    const s = Math.floor((Date.now() - date) / 1000);
    if (s < 5)  return 'just now';
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    return `${Math.floor(s/3600)}h ago`;
  },

  // ── DATA GROUPING ─────────────────────────────────
  groupByProject(rows) {
    const map = new Map();
    rows.forEach(r => {
      const key = r.projectId ? String(r.projectId) : r.projectName;
      if (!map.has(key)) {
        map.set(key, {
          projectId:   r.projectId,
          projectName: r.projectName,
          initiative:  r.initiative,
          portfolio:   r.portfolio,
          priority:    r.priority,
          weekOf:      r.weekOf,
          status:      r.status,   // highest-severity status
          tasks:       [],
        });
      }
      const proj = map.get(key);
      // Escalate status severity
      proj.status = this.escalateStatus(proj.status, r.status);
      proj.tasks.push(r);
    });
    return Array.from(map.values());
  },

  escalateStatus(current, incoming) {
    const order = ['Complete', 'Not Started', 'In Progress', 'Blocked'];
    const ci = order.indexOf(current);
    const ii = order.indexOf(incoming);
    return ii > ci ? incoming : current;
  },

  groupByInitiative(rows) {
    const map = new Map();
    rows.forEach(r => {
      const key = r.initiative || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return map;
  },

  groupByWeek(rows) {
    const map = new Map();
    rows.forEach(r => {
      const key = r.weekOf || 'unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return map;
  },

  // ── PROGRESS CALC FOR A PROJECT ───────────────────
  calcProjectProgress(tasks) {
    const taskTypes = ['Package', 'Processing', 'Review'];
    const result = {};
    taskTypes.forEach(t => {
      const matching = tasks.filter(r => r.task === t);
      if (!matching.length) { result[t] = null; return; }
      const avg = matching.reduce((s, r) => s + this.progressToPercent(r.progress), 0) / matching.length;
      result[t] = Math.round(avg);
    });
    return result;
  },

  // ── INITIATIVE SUMMARY ────────────────────────────
  calcInitiativeSummary(rows) {
    const projects = this.groupByProject(rows);
    const total  = projects.length;
    const byStatus = { 'In Progress': 0, 'Blocked': 0, 'Not Started': 0, 'Complete': 0 };
    projects.forEach(p => { if (byStatus[p.status] !== undefined) byStatus[p.status]++; });
    return { total, ...byStatus };
  },

  // ── SEARCH ────────────────────────────────────────
  matchesSearch(row, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    return [row.projectName, row.initiative, row.assignedTo, row.actionHolder,
            row.status, row.task, row.comments, row.portfolio]
      .some(v => v && String(v).toLowerCase().includes(q));
  },

  // ── ESCAPE HTML ───────────────────────────────────
  esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  // ── TOAST ─────────────────────────────────────────
  toast(msg, type = 'success') {
    const existing = document.getElementById('toast-el');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'toast-el';
    el.style.cssText = `
      position:fixed;bottom:20px;right:20px;z-index:99999;
      padding:10px 18px;border-radius:10px;font-size:.82rem;font-weight:600;
      font-family:'DM Sans',sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.25);
      animation:slideInToast .3s ease;pointer-events:none;
      background:${type==='error'?'#dc2626':type==='warn'?'#d97706':'#16a34a'};color:#fff;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .4s'; setTimeout(()=>el.remove(),400); }, 3000);
  },
};
