/**
 * apps-script.gs
 * Google Apps Script Web App — EQ Project Tracker
 *
 * Deploy as: Web app → Execute as Me → Anyone can access
 * Then paste the web app URL into config.js → APPS_SCRIPT_URL
 */

const SHEET_NAME = 'Project Management'; // Change if needed

function doGet(e) {
  try {
    const sheetName = (e && e.parameter && e.parameter.sheet) || SHEET_NAME;
    const ss        = SpreadsheetApp.getActiveSpreadsheet();
    const sheet     = ss.getSheetByName(sheetName);

    if (!sheet) {
      return jsonResponse({ error: `Sheet "${sheetName}" not found` }, 404);
    }

    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const rows    = [];

    for (let i = 1; i < data.length; i++) {
      const row = {};
      headers.forEach((h, j) => {
        let val = data[i][j];
        // Convert Date objects to ISO string
        if (val instanceof Date) {
          val = val.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
        }
        row[h] = val === null || val === undefined ? '' : val;
      });

      // Skip rows where both Project ID and Project Name are empty
      const id   = String(row['Project ID']   || '').trim();
      const name = String(row['Project Name'] || '').trim();
      if (!id && !name) continue;

      rows.push(row);
    }

    return jsonResponse({ rows, count: rows.length, sheet: sheetName });

  } catch (err) {
    return jsonResponse({ error: err.toString() }, 500);
  }
}

function jsonResponse(data, status) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Test function — run this in the Apps Script IDE to verify it works
 */
function test() {
  const result = doGet(null);
  Logger.log(result.getContent());
}
