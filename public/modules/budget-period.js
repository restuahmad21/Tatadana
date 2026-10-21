/**
 * TataDana Fintech SaaS — Round 2 Multi-Period Budget Module (R1 - R4)
 * Handles:
 *  - Active period state management (daily | weekly | monthly, default: monthly)
 *  - Dynamic calculation engine for category budget limits & spending in Asia/Jakarta timezone
 *  - Percentage and remaining budget calculation with 0/NaN guards and clamping
 *  - Progress bar width & color transition (normal: orange, warning >=80%: amber, danger >=100%: rose)
 *  - Dynamic alert badges for >=80% and >=100%
 *  - Standardized Indonesian Rupiah text quota display
 *  - Dual UI tab selectors and card rendering in Subtab Budget & Beranda Keuangan
 *  - Universal isomorphic export (browser window & Node.js CommonJS)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  }
  if (typeof root === 'object') {
    root.TataDanaBudgetPeriod = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  // Global active period state: 'daily' | 'weekly' | 'monthly' (Default: 'monthly')
  let activePeriod = 'monthly';
  let cachedState = null;

  /**
   * Convert any date or timestamp into YYYY-MM-DD in Asia/Jakarta (WIB, UTC+7)
   * @param {Date|string|number} d 
   * @returns {string} YYYY-MM-DD
   */
  function toWibDateKey(d) {
    if (!d) return '';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(dateObj);
    } catch (e) {
      // Fallback for environments lacking full ICU
      const tzOffset = 7 * 60; // WIB is UTC+7
      const local = new Date(dateObj.getTime() + tzOffset * 60000);
      return local.toISOString().slice(0, 10);
    }
  }

  /**
   * Format a numeric amount to Indonesian Rupiah with dot separators
   * e.g. 1500000 -> "Rp1.500.000"
   * @param {number} amount 
   * @returns {string}
   */
  function formatRupiah(amount) {
    const num = Math.round(Math.max(0, Number(amount) || 0));
    return 'Rp' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /**
   * Format a number with dot separators
   * e.g. 50000 -> "50.000"
   * @param {number} num 
   * @returns {string}
   */
  function formatNumber(num) {
    const val = Math.round(Math.max(0, Number(num) || 0));
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /**
   * Calculate budget limit, spending, percentage, and alert status for a category budget
   * Supports flexible signatures:
   *  (budget, transactions, period, refDate) OR (budget, period, transactions, refDate)
   * 
   * @param {Object} budget Category budget object { category_id, category_name, monthly_limit, ... }
   * @param {Array|string} arg2 transactions array OR period string
   * @param {string|Array} arg3 period string OR transactions array
   * @param {Date|string|null} arg4 reference date
   * @returns {Object} Calculated metrics
   */
  function calculateCategoryBudgetPeriod(budget, arg2, arg3, arg4) {
    let transactions = [];
    let period = activePeriod;
    let refDate = null;

    if (typeof arg2 === 'string') {
      period = arg2;
      transactions = Array.isArray(arg3) ? arg3 : [];
      refDate = arg4;
    } else {
      transactions = Array.isArray(arg2) ? arg2 : [];
      if (typeof arg3 === 'string') period = arg3;
      refDate = arg4;
    }

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      period = 'monthly';
    }

    const monthlyLimit = Math.max(0, Number(budget && budget.monthly_limit) || 0);

    // 1. Calculate Period Limit
    let limit = 0;
    if (period === 'daily') {
      limit = monthlyLimit > 0 ? Math.round(monthlyLimit / 30) : 0;
    } else if (period === 'weekly') {
      limit = monthlyLimit > 0 ? Math.round(monthlyLimit / 4) : 0;
    } else {
      limit = monthlyLimit;
    }

    // 2. Resolve Reference Date (WIB Asia/Jakarta)
    let refDateObj = new Date();
    if (refDate instanceof Date && !isNaN(refDate.getTime())) {
      refDateObj = refDate;
    } else if (refDate) {
      const parsed = new Date(refDate);
      if (!isNaN(parsed.getTime())) refDateObj = parsed;
    }
    const refTime = refDateObj.getTime();
    const refWibDate = toWibDateKey(refDateObj);
    const refYear = refDateObj.getFullYear();
    const refMonth = refDateObj.getMonth();

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

    // 3. Filter Matching Expenses
    const catExpenses = (transactions || []).filter(t => {
      if (!t || t.type !== 'expense') return false;
      const bCatId = budget && budget.category_id;
      const bCatName = budget && budget.category_name ? String(budget.category_name).toLowerCase().trim() : '';
      const tCatId = t.category_id;
      const tCatName = t.category_name ? String(t.category_name).toLowerCase().trim() : '';

      const catIdMatch = Boolean(bCatId && tCatId && bCatId === tCatId);
      const catNameMatch = Boolean(bCatName && tCatName && (bCatName === tCatName || bCatName.includes(tCatName) || tCatName.includes(bCatName)));
      return catIdMatch || catNameMatch;
    });

    let spent = 0;
    catExpenses.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      if (amt <= 0) return;
      const txDate = new Date(tx.transaction_date || tx.date);
      const txTime = txDate.getTime();
      if (isNaN(txTime)) return;

      if (period === 'daily') {
        if (toWibDateKey(txDate) === refWibDate) {
          spent += amt;
        }
      } else if (period === 'weekly') {
        if (refTime - txTime <= SEVEN_DAYS_MS && refTime >= txTime) {
          spent += amt;
        }
      } else {
        // monthly
        if (txDate.getFullYear() === refYear && txDate.getMonth() === refMonth) {
          spent += amt;
        }
      }
    });

    // 4. Percentage & Utilization Calculations
    const rawPct = limit > 0 ? (spent / limit) * 100 : 0;
    const percentage = (!isFinite(rawPct) || isNaN(rawPct) || limit <= 0) ? 0 : Math.round(rawPct);
    const clampedPct = Math.min(100, Math.max(0, percentage));
    const remaining = Math.max(0, limit - spent);

    // 5. Alert Thresholds
    let status = 'normal';
    let hasWarning = false;
    let hasDanger = false;

    if (rawPct >= 100) {
      status = 'danger';
      hasDanger = true;
    } else if (rawPct >= 80) {
      status = 'warning';
      hasWarning = true;
    }

    const periodLabel = period === 'daily' ? 'Harian' : (period === 'weekly' ? 'Mingguan' : 'Bulanan');

    return {
      period,
      periodLabel,
      monthly_limit: monthlyLimit,
      limit,
      spent,
      remaining,
      percentage,
      rawPercentage: rawPct,
      clampedPct,
      progressBarWidth: clampedPct,
      status,
      hasWarning,
      hasDanger,
      isWarning: hasWarning,
      isDanger: hasDanger,
      isOverBudget: hasDanger,
      // Field aliases for test runners
      dailyLimit: limit,
      weeklyLimit: limit,
      monthlyLimit: limit,
      dailySpent: spent,
      weeklySpent: spent,
      monthlySpent: spent
    };
  }

  /**
   * Get currently active budget period
   * @returns {'daily' | 'weekly' | 'monthly'}
   */
  function getActivePeriod() {
    return activePeriod;
  }

  /**
   * Set active budget period and update all UI views reactively
   * @param {'daily' | 'weekly' | 'monthly'} newPeriod 
   * @param {Object} [customState]
   */
  function setActivePeriod(newPeriod, customState) {
    if (['daily', 'weekly', 'monthly'].includes(newPeriod)) {
      activePeriod = newPeriod;
      if (typeof window !== 'undefined') {
        window.activeBudgetPeriod = activePeriod;
      }
      syncTabsUI();
      renderAllBudgetSections(customState);
    }
  }

  /**
   * Synchronize visual styling of all period tab selector buttons in the DOM
   */
  function syncTabsUI() {
    if (typeof document === 'undefined') return;

    // Update active badge in overview if element exists
    const overviewBadge = document.getElementById('overview-budget-period-badge');
    if (overviewBadge) {
      overviewBadge.innerText = activePeriod === 'daily' ? 'Harian' : (activePeriod === 'weekly' ? 'Mingguan' : 'Bulanan');
    }

    const tabButtons = document.querySelectorAll('.budget-tab-btn, [data-period]');
    tabButtons.forEach(btn => {
      const btnPeriod = btn.getAttribute('data-period');
      if (!btnPeriod) return;

      const isActive = btnPeriod === activePeriod;
      if (isActive) {
        btn.className = 'budget-tab-btn px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 bg-orange-600 text-white shadow-sm shadow-orange-600/30 cursor-default';
      } else {
        btn.className = 'budget-tab-btn px-4 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-orange-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer';
      }
    });
  }

  /**
   * Render HTML markup for an individual category budget card
   * @param {Object} budget 
   * @param {Object} stats 
   * @returns {string} HTML markup
   */
  function renderCardHtml(budget, stats) {
    const { limit, spent, percentage, clampedPct, isWarning, isDanger, periodLabel } = stats;

    let barColor = 'bg-orange-500';
    let borderClass = 'border-zinc-200 dark:border-zinc-800';
    let badgeHtml = '';

    if (isDanger) {
      barColor = 'bg-rose-500 shadow-sm shadow-rose-500/50';
      borderClass = 'border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-500/20';
      badgeHtml = `
        <div class="budget-alert-badge flex items-center justify-between px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 text-[11px] font-semibold">
          <span class="flex items-center gap-1.5">
            <span>🚨</span> <span>Over-budget! Melebihi limit ${periodLabel.toLowerCase()} (${percentage}%).</span>
          </span>
          <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-200/50 dark:bg-rose-900/50 text-rose-700 dark:text-rose-200">Bahaya</span>
        </div>
      `;
    } else if (isWarning) {
      barColor = 'bg-amber-500 shadow-sm shadow-amber-500/50';
      borderClass = 'border-amber-300 dark:border-amber-900/60';
      badgeHtml = `
        <div class="budget-alert-badge flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 text-[11px] font-semibold">
          <span class="flex items-center gap-1.5">
            <span>⚠️</span> <span>Alert 80% tercapai! Mendekati batas limit.</span>
          </span>
          <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-200/50 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">Waspada</span>
        </div>
      `;
    }

    const quotaText = `Rp${formatNumber(spent)} / Rp${formatNumber(limit)} (${percentage}%)`;

    return `
      <div class="category-budget-card p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border ${borderClass} space-y-3 shadow-sm hover:shadow-md transition-shadow" data-category-id="${budget.category_id || budget.id}">
        <div class="flex justify-between items-center text-xs font-bold">
          <div class="flex items-center gap-2 text-zinc-900 dark:text-white">
            <span class="text-base">${budget.category_emoji || '🎯'}</span>
            <span>${budget.category_name}</span>
          </div>
          <div class="font-mono ${isDanger ? 'text-rose-500 font-black' : (isWarning ? 'text-amber-500 font-bold' : 'text-zinc-700 dark:text-zinc-300')}">
            ${quotaText}
          </div>
        </div>

        <!-- Animated Progress Bar with 500ms ease-out transition -->
        <div class="w-full h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div class="budget-progress-bar h-full ${barColor} rounded-full transition-all duration-500 ease-out" style="width: ${clampedPct}%"></div>
        </div>

        ${badgeHtml}
      </div>
    `;
  }

  /**
   * Render category cards into a designated container element
   * @param {string} containerId 
   * @param {Array} budgets 
   * @param {Array} transactions 
   * @param {string} period 
   */
  function renderContainer(containerId, budgets = [], transactions = [], period = activePeriod) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!Array.isArray(budgets) || budgets.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-8 text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-2">
          <p class="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Belum ada batas budget yang diatur</p>
          <div class="pt-1">
            <button type="button" onclick="openSetBudgetModal()" class="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md shadow-orange-600/20 transition-all inline-flex items-center gap-1.5">
              <span>⚙️</span> Atur Budget
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = budgets.map(b => {
      const stats = calculateCategoryBudgetPeriod(b, transactions, period);
      return renderCardHtml(b, stats);
    }).join('');
  }

  /**
   * Render all budget containers across both Subtab Budget and Beranda Keuangan
   * @param {Object} customState Optional state override
   */
  function renderAllBudgetSections(customState) {
    if (typeof document === 'undefined') return;

    if (customState) {
      cachedState = customState;
    }

    const state = customState || (typeof window !== 'undefined' && window.appState ? window.appState : (typeof globalThis !== 'undefined' && globalThis.appState ? globalThis.appState : cachedState));
    if (state && !cachedState) {
      cachedState = state;
    }

    const budgets = (state && Array.isArray(state.budgets)) ? state.budgets : [];
    const transactions = (state && Array.isArray(state.transactions)) ? state.transactions : [];

    // Render Subtab Budget container (#budgets-container)
    renderContainer('budgets-container', budgets, transactions, activePeriod);

    // Render Beranda Keuangan container (#overview-budgets-container or #home-budgets-container)
    renderContainer('overview-budgets-container', budgets, transactions, activePeriod);
    renderContainer('home-budgets-container', budgets, transactions, activePeriod);

    syncTabsUI();
  }

  // Initialize event delegation or DOM binding once DOM is ready in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        syncTabsUI();
      });
    } else {
      syncTabsUI();
    }
  }

  return {
    // State management
    getActivePeriod,
    getActiveBudgetPeriod: getActivePeriod,
    setActivePeriod,
    setActiveBudgetPeriod: setActivePeriod,
    switchPeriod: setActivePeriod,
    switchBudgetPeriod: setActivePeriod,
    setPeriod: setActivePeriod,
    activePeriod,

    // Calculation engines & helpers
    calculateCategoryBudgetPeriod,
    calculateCategoryBudget: calculateCategoryBudgetPeriod,
    calculateBudgetPeriod: calculateCategoryBudgetPeriod,
    toWibDateKey,
    formatRupiah,
    formatNumber,

    // Rendering & UI
    renderCardHtml,
    renderContainer,
    renderAllBudgetSections,
    renderCategoryBudgets: renderAllBudgetSections,
    render: renderAllBudgetSections,
    syncTabsUI
  };
}));
