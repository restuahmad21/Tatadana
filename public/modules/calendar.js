// ====================================================================
// TataDana Fintech SaaS: Interactive Monthly Budget Calendar (M3)
// Modular Frontend Component with Full Persistent Notes CRUD System
// ====================================================================

(function () {
  'use strict';

  const MONTH_NAMES_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const DAY_NAMES_ID = [
    'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
  ];

  // Internal Calendar State
  let calState = {
    year: 2026,
    month: 10, // 1-12
    selectedDate: '2026-10-10', // YYYY-MM-DD
    notes: [], // Loaded from backend database
    initialized: false,
    loadingNotes: false
  };

  /**
   * Helper: Convert Date or ISO string to YYYY-MM-DD in Asia/Jakarta (WIB)
   */
  function toWibDateKey(dateInput) {
    if (!dateInput) return '';
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
   * Helper: Format Currency (IDR)
   */
  function formatIDR(amount) {
    const num = Number(amount || 0);
    return 'Rp' + Math.abs(num).toLocaleString('id-ID');
  }

  /**
   * Helper: Escape HTML string
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Helper: Format full Indonesian date label (e.g. "Sabtu, 10 Oktober 2026")
   */
  function formatIndonesianFullDate(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(Date.UTC(y, m, d, 12, 0, 0));
    const dayOfWeek = DAY_NAMES_ID[dateObj.getUTCDay()];
    return `${dayOfWeek}, ${d} ${MONTH_NAMES_ID[m]} ${y}`;
  }

  /**
   * Get all transactions grouped by YYYY-MM-DD from global appState
   */
  function getGroupedTransactions() {
    const txs = (window.appState && window.appState.transactions) ? window.appState.transactions : [];
    const grouped = {};
    for (const t of txs) {
      const k = toWibDateKey(t.transaction_date);
      if (!k) continue;
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(t);
    }
    return grouped;
  }

  /**
   * Get all notes grouped by YYYY-MM-DD
   */
  function getGroupedNotes() {
    const notes = calState.notes || [];
    const grouped = {};
    for (const n of notes) {
      const k = n.date;
      if (!k) continue;
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(n);
    }
    return grouped;
  }

  /**
   * Fetch notes from backend database
   */
  async function fetchBackendNotes() {
    try {
      calState.loadingNotes = true;
      const res = await fetch('/api/calendar/notes');
      const data = await res.json();
      if (data.ok && Array.isArray(data.notes)) {
        calState.notes = data.notes;
        if (window.appState) {
          window.appState.calendarNotes = data.notes;
        }
      }
    } catch (err) {
      console.warn('Gagal memuat catatan kalender dari backend:', err);
    } finally {
      calState.loadingNotes = false;
    }
  }

  /**
   * Calculate daily cashflow statistics
   */
  function calcDayStats(txList = []) {
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
   * Auto initialize year and month from appState transactions or current date
   */
  function autoInitYearMonth() {
    if (calState.initialized) return;

    if (window.appState && window.appState.calendarNotes && Array.isArray(window.appState.calendarNotes)) {
      calState.notes = window.appState.calendarNotes;
    }

    const txs = (window.appState && window.appState.transactions) ? window.appState.transactions : [];
    if (txs.length > 0 && txs[0].transaction_date) {
      const d = new Date(txs[0].transaction_date);
      if (!isNaN(d.getTime())) {
        calState.year = d.getFullYear();
        calState.month = d.getMonth() + 1;
        calState.selectedDate = toWibDateKey(txs[0].transaction_date);
        calState.initialized = true;
        fetchBackendNotes();
        return;
      }
    }

    const now = new Date();
    calState.year = now.getFullYear();
    calState.month = now.getMonth() + 1;
    calState.selectedDate = toWibDateKey(now);
    calState.initialized = true;
    fetchBackendNotes();
  }

  /**
   * Main render function for #dash-calendar
   */
  function renderCalendarView() {
    const container = document.getElementById('dash-calendar');
    if (!container) return;

    autoInitYearMonth();

    const groupedTx = getGroupedTransactions();
    const groupedNotes = getGroupedNotes();
    const year = calState.year;
    const month = calState.month; // 1-12

    // Month calculations
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

    // Calculate month totals
    let monthIncome = 0;
    let monthExpense = 0;
    let activeDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTxs = groupedTx[dStr] || [];
      if (dayTxs.length > 0) {
        activeDays++;
        const s = calcDayStats(dayTxs);
        monthIncome += s.income;
        monthExpense += s.expense;
      }
    }
    const monthNet = monthIncome - monthExpense;

    // Build Calendar HTML
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header & Month Controls -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900/70 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-2xl">📅</span>
              <h2 class="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Kalender Riwayat Transaksi & Agenda</h2>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 uppercase">
                CRUD AKTIF & TERSIMPAN
              </span>
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Petakan riwayat mutasi keuangan harian dan kelola catatan / notes agenda pada tanggal tertentu secara langsung ke database.
            </p>
          </div>

          <!-- Navigation Controls -->
          <div class="flex items-center gap-2">
            <button id="cal-prev-month" onclick="window.calendarModule.goToPrevMonth()" class="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-600 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5" title="Bulan Sebelumnya">
              <span>◀</span>
              <span class="hidden sm:inline">Bulan Sebelumnya</span>
            </button>
            <div id="cal-current-month-label" class="px-4 py-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-extrabold text-sm border border-orange-500/20 text-center min-w-[150px]">
              ${MONTH_NAMES_ID[month - 1]} ${year}
            </div>
            <button id="cal-next-month" onclick="window.calendarModule.goToNextMonth()" class="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-600 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5" title="Bulan Berikutnya">
              <span class="hidden sm:inline">Bulan Berikutnya</span>
              <span>▶</span>
            </button>
            <button id="cal-today-btn" onclick="window.calendarModule.goToToday()" class="px-3 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs transition-colors" title="Kembali ke Hari Ini">
              Hari Ini
            </button>
          </div>
        </div>

        <!-- Monthly Cashflow Metric Ribbon -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div class="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
              <span>🟢</span> <span>Total Pemasukan Bulan Ini</span>
            </div>
            <div id="cal-month-income" class="text-lg font-black text-emerald-500 mt-1">
              +${formatIDR(monthIncome)}
            </div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div class="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
              <span>🔴</span> <span>Total Pengeluaran Bulan Ini</span>
            </div>
            <div id="cal-month-expense" class="text-lg font-black text-orange-500 mt-1">
              -${formatIDR(monthExpense)}
            </div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div class="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
              <span>⚖️</span> <span>Net Cashflow Bulan Ini</span>
            </div>
            <div id="cal-month-net" class="text-lg font-black ${monthNet >= 0 ? 'text-emerald-500' : 'text-red-500'} mt-1">
              ${monthNet >= 0 ? '+' : '-'}${formatIDR(monthNet)}
            </div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div class="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
              <span>📝</span> <span>Total Catatan / Notes</span>
            </div>
            <div id="cal-month-active-days" class="text-lg font-black text-zinc-900 dark:text-white mt-1">
              ${(calState.notes || []).length} Catatan Tersimpan
            </div>
          </div>
        </div>

        <!-- Main Layout: Grid Calendar & Daily Details Panel -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <!-- Left/Top: Monthly Calendar Grid (7 columns) -->
          <div class="lg:col-span-7 bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            
            <div class="flex items-center justify-between text-xs font-bold text-zinc-400 px-2 pb-1 border-b border-zinc-100 dark:border-zinc-800">
              <span>Pilih tanggal untuk melihat mutasi & catatan</span>
              <div class="flex items-center gap-3 text-[11px] flex-wrap">
                <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Pemasukan</span>
                <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-orange-500"></span> Pengeluaran</span>
                <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-purple-500"></span> Keduanya</span>
                <span class="inline-flex items-center gap-1"><span class="text-xs">📝</span> Notes</span>
              </div>
            </div>

            <!-- Day of Week Header -->
            <div class="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-zinc-400 uppercase py-1">
              <span class="text-red-400">Min</span>
              <span>Sen</span>
              <span>Sel</span>
              <span>Rab</span>
              <span>Kam</span>
              <span>Jum</span>
              <span>Sab</span>
            </div>

            <!-- Day Cells Grid (5-6 Rows x 7 Cols) -->
            <div id="cal-month-grid" class="grid grid-cols-7 gap-1.5">
              ${renderCalendarGridCells(year, month, firstDayIndex, daysInMonth, daysInPrevMonth, groupedTx, groupedNotes)}
            </div>
          </div>

          <!-- Right/Bottom: Selected Date Breakdown Panel -->
          <div id="cal-daily-breakdown" class="lg:col-span-5 bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
            ${renderDailyBreakdownContent(calState.selectedDate, groupedTx, groupedNotes)}
          </div>
        </div>
      </div>

      <!-- Modal Component for Adding / Editing Calendar Note (Requirement 2) -->
      <div id="modal-cal-note" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div class="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div class="flex items-center gap-2">
              <span class="text-xl">📝</span>
              <h3 id="modal-cal-note-title" class="font-extrabold text-base text-zinc-900 dark:text-white">Tambah Catatan Kalender</h3>
            </div>
            <button type="button" onclick="window.calendarModule.closeNoteModal()" class="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center font-bold text-sm">
              ✕
            </button>
          </div>

          <form id="form-cal-note" onsubmit="window.calendarModule.submitNoteForm(event)" class="space-y-3.5 text-xs">
            <input type="hidden" id="cal-note-id" value="">
            
            <div>
              <label class="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Tanggal Catatan</label>
              <input type="date" id="cal-note-date" required class="w-full bg-slate-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white font-mono text-xs">
            </div>

            <div>
              <label class="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Judul Catatan</label>
              <input type="text" id="cal-note-title-input" placeholder="Contoh: Evaluasi Belanja & Rencana Tabungan" required class="w-full bg-slate-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white text-xs">
            </div>

            <div>
              <label class="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Isi / Keterangan Catatan</label>
              <textarea id="cal-note-content-input" rows="3" placeholder="Tuliskan catatan keuangan, pengingat jatuh tempo, atau rencana penghematan di sini..." required class="w-full bg-slate-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white text-xs resize-none"></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Kategori Terkait</label>
                <select id="cal-note-category" class="w-full bg-slate-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white text-xs">
                  <option value="cat_makanan">🍜 Makanan & Minuman</option>
                  <option value="cat_transport">🚗 Transportasi</option>
                  <option value="cat_tagihan">🏠 Tagihan & Utilitas</option>
                  <option value="cat_belanja">👕 Belanja & Kebutuhan</option>
                  <option value="cat_hiburan">🎮 Hiburan & Lifestyle</option>
                  <option value="cat_tabungan">💰 Target Tabungan</option>
                  <option value="cat_lain" selected>📝 Evaluasi Umum</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Prioritas / Urgensi</label>
                <select id="cal-note-priority" class="w-full bg-slate-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white text-xs">
                  <option value="low">🟢 Normal / Info</option>
                  <option value="medium" selected>🟡 Penting</option>
                  <option value="high">🔴 Mendesak / Jatuh Tempo</option>
                </select>
              </div>
            </div>

            <div class="pt-2 flex items-center gap-2">
              <button type="submit" id="btn-save-cal-note" class="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-lg shadow-orange-600/30 transition-all flex items-center justify-center gap-1.5">
                <span>💾</span> <span id="btn-save-note-text">Simpan Catatan ke Database</span>
              </button>
              <button type="button" onclick="window.calendarModule.closeNoteModal()" class="px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                Batal
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Helper: Render the 35 or 42 cells for the calendar month
   */
  function renderCalendarGridCells(year, month, firstDayIndex, daysInMonth, daysInPrevMonth, groupedTx, groupedNotes) {
    let cellsHtml = '';

    // 1. Previous Month Leading Days
    for (let i = 0; i < firstDayIndex; i++) {
      const prevDayNum = daysInPrevMonth - firstDayIndex + i + 1;
      cellsHtml += `
        <div class="h-20 sm:h-24 p-1.5 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/40 border border-dashed border-zinc-200/50 dark:border-zinc-850/50 opacity-40 text-zinc-400 flex flex-col justify-between select-none">
          <span class="text-xs font-semibold">${prevDayNum}</span>
        </div>
      `;
    }

    // 2. Current Month Days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = (calState.selectedDate === dateKey);
      const txList = groupedTx[dateKey] || [];
      const noteList = groupedNotes[dateKey] || [];
      const hasMutations = (txList.length > 0);
      const hasNotes = (noteList.length > 0);

      const hasIncome = txList.some(t => t.type === 'income');
      const hasExpense = txList.some(t => t.type === 'expense');

      let indicatorDotClass = '';
      if (hasIncome && hasExpense) {
        indicatorDotClass = 'bg-purple-500 shadow-purple-500/50';
      } else if (hasIncome) {
        indicatorDotClass = 'bg-emerald-500 shadow-emerald-500/50';
      } else if (hasExpense) {
        indicatorDotClass = 'bg-orange-500 shadow-orange-500/50';
      }

      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const isSunday = (dayOfWeek === 0);

      // Card Classes
      const selectedClasses = isSelected
        ? 'ring-2 ring-orange-500 bg-orange-500/10 border-orange-500/40 dark:border-orange-500/60 shadow-md shadow-orange-500/10'
        : 'bg-zinc-50/80 dark:bg-zinc-950/80 border-zinc-200/80 dark:border-zinc-800 hover:border-orange-500/50 hover:bg-orange-500/5';

      cellsHtml += `
        <div 
          id="cal-cell-${dateKey}"
          data-date="${dateKey}"
          data-has-mutations="${hasMutations ? 'true' : 'false'}"
          data-has-notes="${hasNotes ? 'true' : 'false'}"
          onclick="window.calendarModule.selectCalendarDate('${dateKey}')"
          class="h-20 sm:h-24 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${selectedClasses}"
        >
          <!-- Cell Top: Day Number & Mutation/Note Badges -->
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold ${isSelected ? 'text-orange-500' : (isSunday ? 'text-red-400' : 'text-zinc-700 dark:text-zinc-300')}">
              ${day}
            </span>
            <div class="flex items-center gap-1">
              ${hasNotes ? `
                <span title="${noteList.length} Catatan tersimpan" class="cal-note-badge text-[9px] font-bold px-1 py-0.2 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center">
                  📝${noteList.length}
                </span>
              ` : ''}
              ${hasMutations ? `
                <span class="cal-tx-count-badge text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  ${txList.length}
                </span>
              ` : ''}
            </div>
          </div>

          <!-- Cell Middle/Bottom: Mutation Indicator Dot(s) & Micro Preview -->
          <div class="mt-auto space-y-1">
            ${hasMutations ? `
              <div class="cal-indicator-dots flex items-center gap-1 justify-center py-0.5">
                <span class="w-2.5 h-2.5 rounded-full ${indicatorDotClass} shadow-sm animate-pulse inline-block"></span>
              </div>
              <div class="text-[9px] text-center font-bold truncate hidden sm:block ${hasIncome && !hasExpense ? 'text-emerald-500' : 'text-orange-400'}">
                ${hasIncome && !hasExpense ? `+${formatIDR(calcDayStats(txList).income)}` : `-${formatIDR(calcDayStats(txList).expense)}`}
              </div>
            ` : (hasNotes ? `
              <div class="text-[9px] text-center font-bold text-amber-500 truncate hidden sm:block">
                ${escapeHtml(noteList[0].title)}
              </div>
            ` : `
              <div class="h-2.5"></div>
            `)}
          </div>
        </div>
      `;
    }

    // 3. Next Month Trailing Days (to complete 35 or 42 grid cells)
    const totalRendered = firstDayIndex + daysInMonth;
    const remainingCells = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
    for (let n = 1; n <= remainingCells; n++) {
      cellsHtml += `
        <div class="h-20 sm:h-24 p-1.5 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/40 border border-dashed border-zinc-200/50 dark:border-zinc-850/50 opacity-40 text-zinc-400 flex flex-col justify-between select-none">
          <span class="text-xs font-semibold">${n}</span>
        </div>
      `;
    }

    return cellsHtml;
  }

  /**
   * Helper: Render the Right Column with Cashflow Recap, Notes CRUD, & Filtered Transactions
   */
  function renderDailyBreakdownContent(selectedDateStr, groupedTx, groupedNotes) {
    if (!groupedNotes) groupedNotes = getGroupedNotes();
    const txList = groupedTx[selectedDateStr] || [];
    const notesList = groupedNotes[selectedDateStr] || [];
    const stats = calcDayStats(txList);
    const formattedDate = formatIndonesianFullDate(selectedDateStr);

    return `
      <!-- Heading -->
      <div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-orange-500 uppercase tracking-wider">Rekap Arus Kas & Catatan</span>
          <span class="text-[10px] text-zinc-400 font-mono">${selectedDateStr}</span>
        </div>
        <h3 id="cal-selected-date-heading" class="text-base font-extrabold text-zinc-900 dark:text-white mt-1">
          ${formattedDate}
        </h3>
      </div>

      <!-- 3 Cashflow Recap Cards for Selected Date -->
      <div class="grid grid-cols-3 gap-2 text-center">
        <!-- Pemasukan -->
        <div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <div class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Pemasukan</div>
          <div id="cal-daily-income" class="text-xs sm:text-sm font-black text-emerald-500 mt-1 truncate">
            +${formatIDR(stats.income)}
          </div>
        </div>
        <!-- Pengeluaran -->
        <div class="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20">
          <div class="text-[10px] font-bold text-orange-600 dark:text-orange-400">Pengeluaran</div>
          <div id="cal-daily-expense" class="text-xs sm:text-sm font-black text-orange-500 mt-1 truncate">
            -${formatIDR(stats.expense)}
          </div>
        </div>
        <!-- Net Cashflow -->
        <div class="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
          <div class="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">Net Cashflow</div>
          <div id="cal-daily-net" class="text-xs sm:text-sm font-black ${stats.net >= 0 ? 'text-emerald-500' : 'text-red-500'} mt-1 truncate">
            ${stats.net >= 0 ? '+' : '-'}${formatIDR(stats.net)}
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- SECTION: CATATAN KALENDER / NOTES CRUD (REQUIREMENT 2) -->
      <!-- ============================================================== -->
      <div class="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <span>📝 Catatan & Agenda Tanggal Ini</span>
            <span id="cal-daily-notes-count" class="px-2 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-500 font-extrabold">
              ${notesList.length}
            </span>
          </h4>
          <button type="button" onclick="window.calendarModule.openAddNoteModal('${selectedDateStr}')" class="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px] shadow-sm transition-colors flex items-center gap-1">
            <span>+</span> <span>Tambah Catatan</span>
          </button>
        </div>

        <div id="cal-daily-notes-list" class="space-y-2.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
          ${notesList.length === 0 ? `
            <div class="p-4 text-center rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-dashed border-zinc-200 dark:border-zinc-800 space-y-1">
              <span class="text-xl">📝</span>
              <div class="text-xs font-bold text-zinc-700 dark:text-zinc-300">Belum Ada Catatan</div>
              <p class="text-[10px] text-zinc-400 max-w-xs mx-auto">
                Tambahkan catatan pengingat, evaluasi belanja, atau target tabungan di tanggal ini.
              </p>
            </div>
          ` : notesList.map(note => {
            const prioColor = note.priority === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' : (note.priority === 'low' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20');
            const prioLabel = note.priority === 'high' ? 'Mendesak' : (note.priority === 'low' ? 'Info' : 'Penting');
            return `
              <div class="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-orange-500/30 transition-all space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="space-y-0.5 truncate">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-xs">${note.category_emoji || '📝'}</span>
                      <span class="font-extrabold text-xs text-zinc-900 dark:text-white truncate">${escapeHtml(note.title)}</span>
                      <span class="text-[9px] px-1.5 py-0.2 rounded-full border font-bold ${prioColor}">${prioLabel}</span>
                    </div>
                    <p class="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">${escapeHtml(note.content)}</p>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50 text-[10px]">
                  <span class="text-zinc-400">Tersimpan di Database</span>
                  <div class="flex items-center gap-1.5">
                    <button type="button" onclick="window.calendarModule.openEditNoteModal('${escapeHtml(note.id)}')" class="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-orange-600 hover:text-white font-bold transition-colors">
                      ✏️ Edit
                    </button>
                    <button type="button" onclick="window.calendarModule.deleteCalendarNote('${escapeHtml(note.id)}')" class="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-red-600 hover:text-white font-bold transition-colors">
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Filtered Transaction List Heading & Counter -->
      <div class="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h4 class="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
          <span>Mutasi Transaksi</span>
          <span id="cal-daily-tx-count" class="px-2 py-0.2 rounded-full text-[10px] bg-orange-500/20 text-orange-400 font-extrabold">
            ${txList.length}
          </span>
        </h4>
        <button onclick="openAddTxModal()" class="text-[11px] text-orange-500 hover:underline font-bold">
          + Catat Transaksi
        </button>
      </div>

      <!-- Filtered Transaction List -->
      <div id="cal-daily-transactions-list" class="space-y-2.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
        ${txList.length === 0 ? `
          <div class="p-8 text-center rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-dashed border-zinc-200 dark:border-zinc-800 space-y-2">
            <span class="text-2xl">🌱</span>
            <div class="text-xs font-bold text-zinc-700 dark:text-zinc-300">Tidak Ada Transaksi</div>
            <p class="text-[11px] text-zinc-400 max-w-xs mx-auto">
              Tidak ada mutasi pengeluaran maupun pemasukan yang tercatat pada tanggal ${formattedDate}.
            </p>
          </div>
        ` : txList.map(tx => {
          const isInc = (tx.type === 'income');
          const txTime = new Date(tx.transaction_date).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta'
          });

          return `
            <div class="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-orange-500/30 transition-all flex items-center justify-between">
              <div class="flex items-center gap-3 truncate">
                <div class="w-9 h-9 rounded-xl ${isInc ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'} flex items-center justify-center text-lg shrink-0">
                  ${tx.category_emoji || (isInc ? '💰' : '💳')}
                </div>
                <div class="truncate space-y-0.5">
                  <div class="font-bold text-xs text-zinc-900 dark:text-white truncate">
                    ${escapeHtml(tx.note || tx.category_name || 'Transaksi')}
                  </div>
                  <div class="text-[10px] text-zinc-400 flex items-center gap-1.5 flex-wrap">
                    <span>${escapeHtml(tx.category_name || '-')}</span>
                    <span>•</span>
                    <span>👛 ${escapeHtml(tx.wallet_name || 'BCA')}</span>
                    <span>•</span>
                    <span class="font-mono">${txTime} WIB</span>
                  </div>
                </div>
              </div>
              <div class="text-right shrink-0 ml-2">
                <div class="font-black text-xs sm:text-sm ${isInc ? 'text-emerald-500' : 'text-orange-500'}">
                  ${isInc ? '+' : '-'}${formatIDR(tx.amount)}
                </div>
                <span class="text-[9px] px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-mono">
                  ${tx.source || 'web'}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Action: Navigate to previous month
   */
  function goToPrevMonth() {
    if (calState.month === 1) {
      calState.month = 12;
      calState.year -= 1;
    } else {
      calState.month -= 1;
    }
    calState.selectedDate = `${calState.year}-${String(calState.month).padStart(2, '0')}-01`;
    renderCalendarView();
  }

  /**
   * Action: Navigate to next month
   */
  function goToNextMonth() {
    if (calState.month === 12) {
      calState.month = 1;
      calState.year += 1;
    } else {
      calState.month += 1;
    }
    calState.selectedDate = `${calState.year}-${String(calState.month).padStart(2, '0')}-01`;
    renderCalendarView();
  }

  /**
   * Action: Jump back to today
   */
  function goToToday() {
    const now = new Date();
    calState.year = now.getFullYear();
    calState.month = now.getMonth() + 1;
    calState.selectedDate = toWibDateKey(now);
    renderCalendarView();
  }

  /**
   * Action: Select a specific date in the calendar
   */
  function selectCalendarDate(dateStr) {
    if (!dateStr) return;
    calState.selectedDate = dateStr;

    // Parse year and month to sync view if different
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10);
      if (yr !== calState.year || mo !== calState.month) {
        calState.year = yr;
        calState.month = mo;
        renderCalendarView();
        return;
      }
    }

    // Fast update: update selected styling on cells
    document.querySelectorAll('#cal-month-grid > div[data-date]').forEach(cell => {
      const cellDate = cell.getAttribute('data-date');
      const isSel = (cellDate === dateStr);
      if (isSel) {
        cell.className = 'h-20 sm:h-24 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ring-2 ring-orange-500 bg-orange-500/10 border-orange-500/40 dark:border-orange-500/60 shadow-md shadow-orange-500/10';
      } else {
        cell.className = 'h-20 sm:h-24 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group bg-zinc-50/80 dark:bg-zinc-950/80 border-zinc-200/80 dark:border-zinc-800 hover:border-orange-500/50 hover:bg-orange-500/5';
      }
    });

    // Update daily breakdown panel
    const breakdownEl = document.getElementById('cal-daily-breakdown');
    if (breakdownEl) {
      const groupedTx = getGroupedTransactions();
      const groupedNotes = getGroupedNotes();
      breakdownEl.innerHTML = renderDailyBreakdownContent(dateStr, groupedTx, groupedNotes);
    }
  }

  // ==============================================================
  // NOTES CRUD MODAL & API HANDLERS (REQUIREMENT 2)
  // ==============================================================

  function openAddNoteModal(dateStr) {
    const modal = document.getElementById('modal-cal-note');
    if (!modal) return;
    const titleEl = document.getElementById('modal-cal-note-title');
    const idInput = document.getElementById('cal-note-id');
    const dateInput = document.getElementById('cal-note-date');
    const titleInput = document.getElementById('cal-note-title-input');
    const contentInput = document.getElementById('cal-note-content-input');
    const saveBtnText = document.getElementById('btn-save-note-text');

    if (titleEl) titleEl.innerText = '📝 Tambah Catatan Kalender';
    if (saveBtnText) saveBtnText.innerText = 'Simpan Catatan ke Database';
    if (idInput) idInput.value = '';
    if (dateInput) dateInput.value = dateStr || calState.selectedDate;
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';

    modal.classList.remove('hidden');
    if (titleInput) titleInput.focus();
  }

  function openEditNoteModal(noteId) {
    const note = (calState.notes || []).find(n => n.id === noteId);
    if (!note) return;

    const modal = document.getElementById('modal-cal-note');
    if (!modal) return;
    const titleEl = document.getElementById('modal-cal-note-title');
    const idInput = document.getElementById('cal-note-id');
    const dateInput = document.getElementById('cal-note-date');
    const titleInput = document.getElementById('cal-note-title-input');
    const contentInput = document.getElementById('cal-note-content-input');
    const catSelect = document.getElementById('cal-note-category');
    const prioSelect = document.getElementById('cal-note-priority');
    const saveBtnText = document.getElementById('btn-save-note-text');

    if (titleEl) titleEl.innerText = '✏️ Edit Catatan Kalender';
    if (saveBtnText) saveBtnText.innerText = 'Perbarui Catatan di Database';
    if (idInput) idInput.value = note.id;
    if (dateInput) dateInput.value = note.date;
    if (titleInput) titleInput.value = note.title;
    if (contentInput) contentInput.value = note.content || '';
    if (catSelect && note.category) catSelect.value = note.category;
    if (prioSelect && note.priority) prioSelect.value = note.priority;

    modal.classList.remove('hidden');
    if (titleInput) titleInput.focus();
  }

  function closeNoteModal() {
    const modal = document.getElementById('modal-cal-note');
    if (modal) modal.classList.add('hidden');
  }

  async function submitNoteForm(e) {
    if (e && e.preventDefault) e.preventDefault();
    const idInput = document.getElementById('cal-note-id');
    const dateInput = document.getElementById('cal-note-date');
    const titleInput = document.getElementById('cal-note-title-input');
    const contentInput = document.getElementById('cal-note-content-input');
    const catSelect = document.getElementById('cal-note-category');
    const prioSelect = document.getElementById('cal-note-priority');

    const noteId = idInput ? idInput.value.trim() : '';
    const date = dateInput ? dateInput.value.trim() : '';
    const title = titleInput ? titleInput.value.trim() : '';
    const content = contentInput ? contentInput.value.trim() : '';
    const category = catSelect ? catSelect.value : 'cat_lain';
    const priority = prioSelect ? prioSelect.value : 'medium';

    if (!title || !date) {
      if (typeof window.showToast === 'function') window.showToast('Judul dan tanggal catatan wajib diisi!');
      return;
    }

    const catNameMap = {
      cat_makanan: 'Makanan & Minuman',
      cat_transport: 'Transportasi',
      cat_tagihan: 'Tagihan & Utilitas',
      cat_belanja: 'Belanja & Kebutuhan',
      cat_hiburan: 'Hiburan & Lifestyle',
      cat_tabungan: 'Target Tabungan',
      cat_lain: 'Catatan Harian'
    };

    const catEmojiMap = {
      cat_makanan: '🍜',
      cat_transport: '🚗',
      cat_tagihan: '🏠',
      cat_belanja: '👕',
      cat_hiburan: '🎮',
      cat_tabungan: '💰',
      cat_lain: '📝'
    };

    const payload = {
      date,
      title,
      content,
      category,
      category_name: catNameMap[category] || 'Catatan Harian',
      category_emoji: catEmojiMap[category] || '📝',
      priority
    };

    try {
      let res;
      if (noteId) {
        // Edit / Update
        payload.id = noteId;
        res = await fetch('/api/calendar/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Create / Add
        res = await fetch('/api/calendar/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (data.ok) {
        closeNoteModal();
        if (typeof window.showToast === 'function') {
          window.showToast(noteId ? 'Catatan kalender berhasil diperbarui!' : 'Catatan kalender berhasil disimpan ke database!');
        }
        await fetchBackendNotes();
        calState.selectedDate = date;
        renderCalendarView();
      } else {
        if (typeof window.showToast === 'function') window.showToast(data.error || 'Gagal menyimpan catatan');
      }
    } catch (err) {
      console.error('Error saving note', err);
      if (typeof window.showToast === 'function') window.showToast('Kesalahan jaringan saat menyimpan catatan');
    }
  }

  async function deleteCalendarNote(noteId) {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan kalender ini secara permanen dari database?')) {
      return;
    }

    try {
      const res = await fetch(`/api/calendar/notes?id=${encodeURIComponent(noteId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.ok) {
        if (typeof window.showToast === 'function') {
          window.showToast('Catatan kalender berhasil dihapus secara permanen!');
        }
        await fetchBackendNotes();
        renderCalendarView();
      } else {
        if (typeof window.showToast === 'function') window.showToast(data.error || 'Gagal menghapus catatan');
      }
    } catch (err) {
      console.error('Error deleting note', err);
      if (typeof window.showToast === 'function') window.showToast('Kesalahan jaringan saat menghapus catatan');
    }
  }

  // Expose API globally
  window.calendarModule = {
    renderCalendarView,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    selectCalendarDate,
    openAddNoteModal,
    openEditNoteModal,
    closeNoteModal,
    submitNoteForm,
    deleteCalendarNote,
    fetchBackendNotes,
    getState: () => ({ ...calState }),
    setState: (newState) => {
      calState = { ...calState, ...newState };
      renderCalendarView();
    }
  };

  // Backwards compatibility aliases
  window.renderCalendarView = renderCalendarView;
  window.selectCalendarDate = selectCalendarDate;

})();
