// ====================================================================
// TataDana Fintech SaaS: Calendar Engine & Cashflow Aggregator (M3)
// Includes Real Persistent Calendar Notes CRUD System
// Timezone: Asia/Jakarta (WIB, UTC+7)
// ====================================================================

const fs = require('fs');
const path = require('path');

const NOTES_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'calendar-notes.json');

/**
 * Load persistent calendar notes from JSON database file
 * @returns {Array}
 */
function loadPersistentNotes() {
  try {
    if (fs.existsSync(NOTES_FILE_PATH)) {
      const data = fs.readFileSync(NOTES_FILE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('⚠️ Gagal membaca data/calendar-notes.json:', err.message);
  }
  return [];
}

/**
 * Save calendar notes to JSON database file
 * @param {Array} notes
 */
function savePersistentNotes(notes = []) {
  try {
    const dir = path.dirname(NOTES_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NOTES_FILE_PATH, JSON.stringify(notes, null, 2), 'utf8');
  } catch (err) {
    console.warn('⚠️ Gagal menyimpan data/calendar-notes.json:', err.message);
  }
}

/**
 * Format a Date object or ISO string to 'YYYY-MM-DD' in Asia/Jakarta timezone.
 * @param {string|Date} dateInput
 * @returns {string}
 */
function getWibDateKey(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Extract Year and Month (1-12) in Asia/Jakarta timezone.
 * @param {string|Date} dateInput
 * @returns {{ year: number, month: number }}
 */
function getWibYearMonth(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return { year: 0, month: 0 };
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric'
  }).formatToParts(d);

  let year = 0;
  let month = 0;
  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    if (part.type === 'month') month = parseInt(part.value, 10);
  }
  return { year, month };
}

/**
 * Group transactions by date string (YYYY-MM-DD)
 * @param {Array} transactions
 * @returns {Record<string, Array>}
 */
function groupTransactionsByDate(transactions = []) {
  const groups = {};
  for (const tx of transactions) {
    const key = getWibDateKey(tx.transaction_date);
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return groups;
}

/**
 * Group notes by date string (YYYY-MM-DD)
 * @param {Array} notes
 * @returns {Record<string, Array>}
 */
function groupNotesByDate(notes = []) {
  const groups = {};
  for (const n of notes) {
    const key = n.date;
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  }
  return groups;
}

/**
 * Calculate cashflow for a list of transactions
 * @param {Array} txList
 * @returns {{ income: number, expense: number, net: number, count: number }}
 */
function calculateCashflow(txList = []) {
  let income = 0;
  let expense = 0;
  for (const tx of txList) {
    const amt = Number(tx.amount || 0);
    if (tx.type === 'income') {
      income += amt;
    } else if (tx.type === 'expense') {
      expense += amt;
    }
  }
  return {
    income,
    expense,
    net: income - expense,
    count: txList.length
  };
}

/**
 * Build complete monthly calendar data for a given year and month (1-12)
 * @param {Array} transactions
 * @param {number} year
 * @param {number} month 1-indexed (1 = Jan, 10 = Oct)
 * @param {Array} [notes] optional calendar notes list
 */
function getMonthlyCalendarData(transactions = [], year, month, notes = []) {
  const targetYear = parseInt(year, 10);
  const targetMonth = parseInt(month, 10);

  // Total days in target month
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const dateGroups = groupTransactionsByDate(transactions);
  const noteGroups = groupNotesByDate(notes);

  const days = [];
  let monthTotalIncome = 0;
  let monthTotalExpense = 0;
  let activeDaysCount = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(targetMonth).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${targetYear}-${monthStr}-${dayStr}`;

    const dayTxList = dateGroups[dateKey] || [];
    const dayNotesList = noteGroups[dateKey] || [];
    const stats = calculateCashflow(dayTxList);

    if (stats.count > 0) {
      activeDaysCount++;
      monthTotalIncome += stats.income;
      monthTotalExpense += stats.expense;
    }

    days.push({
      date: dateKey,
      day,
      has_mutations: stats.count > 0,
      transaction_count: stats.count,
      income: stats.income,
      expense: stats.expense,
      net: stats.net,
      transactions: dayTxList,
      notes: dayNotesList,
      note_count: dayNotesList.length,
      has_notes: dayNotesList.length > 0
    });
  }

  const periodStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

  return {
    period: periodStr,
    year: targetYear,
    month: targetMonth,
    days_in_month: daysInMonth,
    active_days: activeDaysCount,
    total_income: monthTotalIncome,
    total_expense: monthTotalExpense,
    net_cashflow: monthTotalIncome - monthTotalExpense,
    days
  };
}

/**
 * Filter transactions and notes for a specific single date
 * @param {Array} transactions
 * @param {string} dateKey 'YYYY-MM-DD'
 * @param {Array} [notes]
 */
function getDayTransactions(transactions = [], dateKey, notes = []) {
  const dayTxList = (transactions || []).filter(tx => getWibDateKey(tx.transaction_date) === dateKey);
  const dayNotesList = (notes || []).filter(n => n.date === dateKey);
  const stats = calculateCashflow(dayTxList);

  return {
    date: dateKey,
    income: stats.income,
    expense: stats.expense,
    net: stats.net,
    transaction_count: stats.count,
    transactions: dayTxList,
    notes: dayNotesList,
    note_count: dayNotesList.length,
    has_notes: dayNotesList.length > 0
  };
}

/**
 * Helper to read request body as JSON
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Object>}
 */
function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/**
 * HTTP API Request Handler for /api/calendar/*
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {object} dbState
 * @param {URL} urlObj
 */
async function handleCalendarApi(req, res, dbState, urlObj) {
  const pathname = urlObj.pathname;
  const method = req.method;
  const searchParams = urlObj.searchParams;

  // Initialize dbState.calendarNotes if not present
  if (!dbState.calendarNotes || !Array.isArray(dbState.calendarNotes)) {
    dbState.calendarNotes = loadPersistentNotes();
  }

  // 1. GET /api/calendar/month?year=2026&month=10 or ?period=2026-10
  if (pathname === '/api/calendar/month' && method === 'GET') {
    let year = searchParams.get('year');
    let month = searchParams.get('month');
    const period = searchParams.get('period');

    if (period && period.includes('-')) {
      const parts = period.split('-');
      year = parts[0];
      month = parts[1];
    }

    if (!year || !month) {
      const txs = dbState.transactions || [];
      if (txs.length > 0) {
        const ym = getWibYearMonth(txs[0].transaction_date);
        year = ym.year;
        month = ym.month;
      } else {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth() + 1;
      }
    }

    const userId = searchParams.get('userId') || (req.headers && req.headers['x-user-id']) || (dbState.user && dbState.user.id);
    const userTxs = userId ? (dbState.transactions || []).filter(t => !t.user_id || t.user_id === userId) : (dbState.transactions || []);
    const userNotes = userId ? (dbState.calendarNotes || []).filter(n => !n.user_id || n.user_id === userId) : (dbState.calendarNotes || []);

    const data = getMonthlyCalendarData(userTxs, year, month, userNotes);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, data }));
    return true;
  }

  // 2. GET /api/calendar/day?date=2026-10-10
  if (pathname === '/api/calendar/day' && method === 'GET') {
    const dateStr = searchParams.get('date');
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Parameter date (YYYY-MM-DD) wajib diisi' }));
      return true;
    }

    const userId = searchParams.get('userId') || (req.headers && req.headers['x-user-id']) || (dbState.user && dbState.user.id);
    const userTxs = userId ? (dbState.transactions || []).filter(t => !t.user_id || t.user_id === userId) : (dbState.transactions || []);
    const userNotes = userId ? (dbState.calendarNotes || []).filter(n => !n.user_id || n.user_id === userId) : (dbState.calendarNotes || []);

    const data = getDayTransactions(userTxs, dateStr, userNotes);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, data }));
    return true;
  }

  // 3. GET /api/calendar/notes (Read notes: all, or by date / period)
  if (pathname === '/api/calendar/notes' && method === 'GET') {
    const qDate = searchParams.get('date');
    const qMonth = searchParams.get('month'); // YYYY-MM
    const userId = searchParams.get('userId') || (req.headers && req.headers['x-user-id']) || (dbState.user && dbState.user.id);
    let notes = userId ? (dbState.calendarNotes || []).filter(n => !n.user_id || n.user_id === userId) : (dbState.calendarNotes || []);

    if (qDate) {
      notes = notes.filter(n => n.date === qDate);
    } else if (qMonth) {
      notes = notes.filter(n => (n.date || '').startsWith(qMonth));
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, count: notes.length, notes }));
    return true;
  }

  // 4. POST /api/calendar/notes (Create Note)
  if (pathname === '/api/calendar/notes' && method === 'POST') {
    const payload = await readJsonBody(req);
    const date = (payload.date || '').trim();
    const title = (payload.title || '').trim();
    const content = (payload.content || '').trim();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Format tanggal harus YYYY-MM-DD' }));
      return true;
    }

    if (!title) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Judul catatan (title) wajib diisi' }));
      return true;
    }

    const newId = 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const nowIso = new Date().toISOString();

    const newNote = {
      id: newId,
      user_id: (dbState.user && dbState.user.id) || 'usr_admin_restu',
      date,
      title,
      content,
      category: payload.category || 'cat_lain',
      category_name: payload.category_name || 'Catatan Harian',
      category_emoji: payload.category_emoji || '📝',
      color: payload.color || '#f97316',
      priority: payload.priority || 'medium',
      created_at: nowIso,
      updated_at: nowIso
    };

    if (!Array.isArray(dbState.calendarNotes)) dbState.calendarNotes = [];
    dbState.calendarNotes.unshift(newNote);
    savePersistentNotes(dbState.calendarNotes);

    res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      status: 201,
      note: newNote,
      message: 'Catatan kalender berhasil disimpan ke database!'
    }));
    return true;
  }

  // 5. PUT /api/calendar/notes/:id or PUT /api/calendar/notes or POST /api/calendar/notes/update
  const isPutNotes = (pathname.startsWith('/api/calendar/notes') && method === 'PUT') ||
                     (pathname === '/api/calendar/notes/update' && method === 'POST');

  if (isPutNotes) {
    const payload = await readJsonBody(req);
    let noteId = searchParams.get('id') || payload.id;
    if (!noteId && pathname.startsWith('/api/calendar/notes/')) {
      const parts = pathname.split('/');
      noteId = parts[parts.length - 1];
    }

    if (!noteId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'ID catatan wajib disertakan' }));
      return true;
    }

    const notes = dbState.calendarNotes || [];
    const targetIdx = notes.findIndex(n => n.id === noteId);
    if (targetIdx < 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: `Catatan dengan ID ${noteId} tidak ditemukan` }));
      return true;
    }

    const existing = notes[targetIdx];
    const updatedNote = {
      ...existing,
      title: payload.title !== undefined ? String(payload.title).trim() : existing.title,
      content: payload.content !== undefined ? String(payload.content).trim() : existing.content,
      date: payload.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(payload.date) ? payload.date : existing.date,
      category: payload.category !== undefined ? payload.category : existing.category,
      category_name: payload.category_name !== undefined ? payload.category_name : existing.category_name,
      category_emoji: payload.category_emoji !== undefined ? payload.category_emoji : existing.category_emoji,
      color: payload.color !== undefined ? payload.color : existing.color,
      priority: payload.priority !== undefined ? payload.priority : existing.priority,
      updated_at: new Date().toISOString()
    };

    notes[targetIdx] = updatedNote;
    savePersistentNotes(notes);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      status: 200,
      note: updatedNote,
      message: 'Catatan kalender berhasil diperbarui di database!'
    }));
    return true;
  }

  // 6. DELETE /api/calendar/notes/:id or DELETE /api/calendar/notes or POST /api/calendar/notes/delete
  const isDeleteNotes = (pathname.startsWith('/api/calendar/notes') && method === 'DELETE') ||
                        (pathname === '/api/calendar/notes/delete' && method === 'POST');

  if (isDeleteNotes) {
    let payload = {};
    if (method === 'POST') payload = await readJsonBody(req);
    let noteId = searchParams.get('id') || payload.id;
    if (!noteId && pathname.startsWith('/api/calendar/notes/')) {
      const parts = pathname.split('/');
      noteId = parts[parts.length - 1];
    }

    if (!noteId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'ID catatan wajib disertakan' }));
      return true;
    }

    const notes = dbState.calendarNotes || [];
    const targetIdx = notes.findIndex(n => n.id === noteId);
    if (targetIdx < 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: `Catatan dengan ID ${noteId} tidak ditemukan` }));
      return true;
    }

    notes.splice(targetIdx, 1);
    savePersistentNotes(notes);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      status: 200,
      message: 'Catatan kalender berhasil dihapus secara permanen dari database!'
    }));
    return true;
  }

  return false;
}

module.exports = {
  loadPersistentNotes,
  savePersistentNotes,
  getWibDateKey,
  getWibYearMonth,
  groupTransactionsByDate,
  groupNotesByDate,
  calculateCashflow,
  getMonthlyCalendarData,
  getDayTransactions,
  handleCalendarApi
};
