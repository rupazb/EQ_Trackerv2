// ═══════════════════════════════════════════════════════
//  config.js — EQ Project Tracker Configuration
//  ▸ Set SHEET_CSV_URL below — that's the only required edit
// ═══════════════════════════════════════════════════════

const CONFIG = {

  // ── GOOGLE SHEETS ──────────────────────────────────
  // Paste your Google Sheet's published CSV URL here.
  //
  // How to get it:
  //   1. Open your Google Sheet
  //   2. File → Share → Publish to web
  //   3. Select your sheet tab (e.g. "Project Management")
  //   4. Change format dropdown to "Comma-separated values (.csv)"
  //   5. Click Publish → copy the full URL and paste below
  //
  // It will look like:
  //   https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv
  //
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQj6UNpK8LqTGHXwuowg7hMqzwixKmeo9OyGhgj094DmEri17RHIbeq8sBELYqGRQ/pub?output=csv',

  // ── LEGACY: only needed if NOT using SHEET_CSV_URL ──
  // If you prefer using the Opensheet proxy, leave SHEET_CSV_URL empty
  // and fill in SHEET_ID + SHEET_NAME instead.
  SHEET_ID:   '1YR1XHNZ2eeUu-oVJyL6uUaQoncRJ3y45',
  SHEET_NAME: 'Project Management',

  // Auto-refresh interval in milliseconds (30 seconds)
  REFRESH_INTERVAL: 30000,

  // ── COLUMN MAPPING ─────────────────────────────────
  // Maps your Google Sheet column headers to internal field names.
  // Adjust if your headers differ from the defaults.
  COLUMNS: {
    PROJECT_ID:    'Project ID',
    PROJECT_NAME:  'Project Name',
    INITIATIVE:    'Initiative',
    TASKS:         'Tasks',          // Package / Processing / Review / Other
    WEEK_OF:       'Starting week of',
    PRIORITY:      'Priority',
    DUE_DATE:      'Due Date',
    PROGRESS:      'Progress',       // Yet to start / In progress / Complete
    END_DATE:      'End Date',
    ASSIGNED_TO:   'Assigned to',
    ACTION_HOLDER: 'Action Holder',  // GreenCollar / Equilibrium
    COMMENTS:      'Comments',
    PORTFOLIO:     'Portfolio',
    STATUS:        'Status',         // Active / Backlog / Blocked / Delivered
  },

  // ── STATUS → KANBAN COLUMN MAPPING ─────────────────
  STATUS_MAP: {
    'Active':    'In Progress',
    'Blocked':   'Blocked',
    'Backlog':   'Not Started',
    'Delivered': 'Complete',
  },

  // ── PROGRESS → PERCENT ─────────────────────────────
  PROGRESS_MAP: {
    'Yet to start': 0,
    'Yet to Start': 0,
    'In progress':  50,
    'In Progress':  50,
    'Complete':     100,
  },

  // ── PRIORITY COLORS ────────────────────────────────
  PRIORITY_DOT: {
    '1. Very High': 'high',
    '2. High':      'high',
    'High':         'high',
    '3. Low':       'low',
    'Low':          'low',
    '4. Nice to have': 'low',
    'Nice to have': 'low',
    'unassigned':   'med',
  },

  // ── OPENSHEET API BASE ─────────────────────────────
  // opensheet.elk.sh provides a simple no-auth JSON wrapper around public Google Sheets
  // Alternatively set USE_APPS_SCRIPT: true and fill APPS_SCRIPT_URL below
  USE_APPS_SCRIPT: false,
  APPS_SCRIPT_URL: '',  // Set this if using Google Apps Script web app

  // ── UI DEFAULTS ────────────────────────────────────
  DEFAULT_THEME: 'light',   // 'light' | 'dark'
};
