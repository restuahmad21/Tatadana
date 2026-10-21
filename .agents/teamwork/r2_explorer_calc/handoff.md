# Handoff Report: Calculation Logic Exploration for TataDana Fintech SaaS (Round 2)

**Agent**: `r2_explorer_calc`  
**Date**: 2026-10-17  
**Working Directory**: `C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana\.agents\teamwork\r2_explorer_calc`  
**Target Milestone**: Round 2 (R2 - Dynamic Calculation Engine for Multi-Period Category Budget)

---

## 1. Observation

### 1.1 Backend Budget & Transaction Architecture (`server.js`)
- **Initial Budgets State** (`server.js:157-164`):
  ```javascript
  budgets: [
    { id: 'bud_makanan', category_id: 'cat_makanan', category_name: 'Makanan & Minuman', category_emoji: '🍜', monthly_limit: 1500000, current_spent: 435000, month_period: '2026-10' },
    { id: 'bud_transport', category_id: 'cat_transport', category_name: 'Transportasi', category_emoji: '🚗', monthly_limit: 500000, current_spent: 250000, month_period: '2026-10' },
    { id: 'bud_hiburan', category_id: 'cat_hiburan', category_name: 'Hiburan & Lifestyle', category_emoji: '🎮', monthly_limit: 800000, current_spent: 720000, month_period: '2026-10' },
    { id: 'bud_belanja', category_id: 'cat_belanja', category_name: 'Belanja & Groceries', category_emoji: '👕', monthly_limit: 1200000, current_spent: 420000, month_period: '2026-10' },
    { id: 'bud_tagihan', category_id: 'cat_tagihan', category_name: 'Tagihan & Utilitas', category_emoji: '🏠', monthly_limit: 1000000, current_spent: 650000, month_period: '2026-10' },
    { id: 'bud_lain', category_id: 'cat_lain', category_name: 'Lain-lain', category_emoji: '💸', monthly_limit: 1000000, current_spent: 0, month_period: '2026-10' },
  ]
  ```
- **Transaction Storage & Schema** (`server.js:165-270` & `1291-1305`):
  Each transaction in `db.transactions` has the structure:
  ```javascript
  {
    id: 'tx_01', // or 'tx_' + timestamp
    wallet_id: 'wal_bca',
    wallet_name: 'BCA Utama',
    category_id: 'cat_makanan', // optional in some telegram transactions
    category_name: 'Makanan & Minuman',
    category_emoji: '🍜',
    type: 'expense', // 'income' | 'expense' | 'transfer'
    amount: 25000,
    note: 'Nasi Padang Rendang + Teh Hangat',
    source: 'telegram_text', // 'web' | 'telegram_text' | 'telegram_receipt' | 'telegram_voice'
    transaction_date: '2026-10-10T12:15:00+07:00' // ISO-8601 string with timezone offset or UTC 'Z'
  }
  ```
- **Transaction Mutation Effects on Budgets** (`server.js:1281-1284` & `server.js:975-977`):
  - On web expense (`POST /api/transactions`):
    ```javascript
    const targetBud = db.budgets.find(b => b.category_id === data.category_id);
    if (targetBud) targetBud.current_spent += amount;
    ```
  - On telegram bot expense (`POST /api/telegram/webhook`):
    ```javascript
    const targetBud = targetDb.budgets.find(b => b.category_name.toLowerCase().includes(categoryName.toLowerCase().slice(0, 4)));
    if (targetBud) targetBud.current_spent += nominal;
    ```
  - On transaction delete (`DELETE /api/transactions/:id`, `server.js:1323-1346`):
    `targetBud.current_spent` is currently *not* decremented upon deletion because `current_spent` was a static mock counter in Round 1. A dynamic query engine calculating directly from `transactions` array will fix this discrepancy naturally!

### 1.2 Frontend Budget Rendering (`public/index.html`)
- **Overview Budget Summary** (`public/index.html:2099-2104`):
  ```javascript
  const totalBudgetLimit = (appState.budgets || []).reduce((a, b) => a + (b.monthly_limit || 0), 0);
  const totalBudgetSpent = (appState.budgets || []).reduce((a, b) => a + (b.current_spent || 0), 0);
  const budgetLeft = Math.max(0, totalBudgetLimit - totalBudgetSpent);
  const budLeftEl = document.getElementById('stat-budget-left');
  if (budLeftEl) budLeftEl.innerText = formatRupiah(budgetLeft);
  ```
- **Category Budget Cards in Subtab Budget** (`public/index.html:2145-2159`):
  ```javascript
  document.getElementById('budgets-container').innerHTML = appState.budgets.map(b => {
    const pct = Math.min(100, Math.round((b.current_spent / b.monthly_limit) * 100));
    return `
      <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
        <div class="flex justify-between text-xs font-bold text-zinc-900 dark:text-white">
          <span>${b.category_emoji} ${b.category_name}</span>
          <span>${formatRupiah(b.current_spent)} / ${formatRupiah(b.monthly_limit)} (${pct}%)</span>
        </div>
        <div class="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div class="h-full bg-orange-500 rounded-full" style="width: ${pct}%"></div>
        </div>
        ${pct >= 80 ? '<p class="text-[10px] text-red-400 font-semibold">⚠️ Alert 80% tercapai! Notifikasi terkirim ke Telegram.</p>' : ''}
      </div>
    `;
  }).join('');
  ```
  *Current Limitation*: Hardcoded to `b.current_spent` and `b.monthly_limit`, lacks time period selection tabs (Harian, Mingguan, Bulanan), lacks alert differentiation for >=100% vs >=80%, and does not dynamically aggregate from `appState.transactions`.

### 1.3 Precedent Implementations in Existing Modules
- **`src/modules/wallet-budget.js` & `public/modules/wallet-budget.js`**:
  Already implements multi-period budget tracking for *wallets* (`calculateWalletBudgetStats` & `calculateClientWalletBudget`):
  - Daily limit: `Math.round(budget_limit / 30)`
  - Weekly limit: `Math.round(budget_limit / 4)`
  - Monthly limit: `budget_limit`
  - Zero/negative limit handling: `Math.max(0, Number(wallet.budget_limit) || 0)`. If 0, limits and percentages are strictly `0`.
- **`public/modules/calendar.js`**:
  Implements standard Indonesian timezone (`Asia/Jakarta` / WIB) date key normalization:
  ```javascript
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
  ```
  This formats dates to `YYYY-MM-DD` in Asia/Jakarta timezone.

---

## 2. Logic Chain

1. **Category Matching Strategy**:
   - In `server.js` and `src/modules/admin-approval.js`, transactions may have `category_id` (from Web) or only `category_name` (from Telegram bot).
   - Therefore, category matching must be robust across:
     1. Exact match on `t.category_id === budget.category_id`
     2. Exact case-insensitive trimmed match on `t.category_name.toLowerCase().trim() === budget.category_name.toLowerCase().trim()`
     3. Case-insensitive substring matching if one name contains the other (e.g. "Makanan" vs "Makanan & Minuman").

2. **Temporal Windowing Logic**:
   - **Daily (Harian)**:
     - Target: expenses on "hari ini" (local Indonesian date `YYYY-MM-DD`).
     - Using `toWibDateKey(tx.transaction_date) === toWibDateKey(refDate)`.
   - **Weekly (Mingguan)**:
     - Target: expenses in the last 7 days (`within 7 days of refDate`).
     - Condition: `isToday || (refTime - txTime <= 7 * 24 * 3600 * 1000 && txTime <= refTime + 60000)`.
   - **Monthly (Bulanan)**:
     - Target: expenses in running calendar month (`YYYY-MM`).
     - Condition: `toWibDateKey(tx.transaction_date).slice(0, 7) === targetMonth` (where `targetMonth = budget.month_period || toWibDateKey(refDate).slice(0, 7)`).

3. **Limit Calculations & Mathematical Guard Rails**:
   - `monthly_limit`: parsed via `Math.max(0, Number(budget.monthly_limit) || 0)`.
   - `daily_limit`: `monthly_limit > 0 ? Math.round(monthly_limit / 30) : 0`.
   - `weekly_limit`: `monthly_limit > 0 ? Math.round(monthly_limit / 4) : 0`.
   - `monthly_limit`: `monthly_limit`.
   - **Percentage**:
     If `limit <= 0`: percentage is strictly `0` (prevents `0 / 0 = NaN` or `spent / 0 = Infinity`).
     If `limit > 0`: `rawPct = (spent / limit) * 100`.
     Guard: `const percentage = (!isFinite(rawPct) || isNaN(rawPct)) ? 0 : Math.round(rawPct)`.
   - **Progress Bar Width**:
     Clamped between 0% and 100%: `Math.min(100, Math.max(0, percentage))`.
   - **Remaining Budget**:
     Clamped to 0: `Math.max(0, limit - spent)`.

4. **Dynamic Alerts & Status Triggers**:
   - `percentage >= 100`: Status `danger`. Badge text `🚨 Over Budget!`. Badge style `bg-rose-500/15 text-rose-500 border border-rose-500/30`. Alert banner: `🚨 Batas budget periode ini telah habis!`.
   - `percentage >= 80 && percentage < 100`: Status `warning`. Badge text `⚠️ Waspada (≥80%)`. Badge style `bg-amber-500/15 text-amber-500 border border-amber-500/30`. Alert banner: `⚠️ Waspada: Kuota budget telah mencapai ${percentage}%!`.
   - `percentage < 80`: Status `safe`. Badge text `Aman`. Normal orange progress bar (`bg-orange-500`).

5. **Fallback Handling for Seeded Data**:
   - In live execution, `appState.transactions` contains all user transactions.
   - However, in seeded mock state, some categories (e.g. `cat_hiburan`) have `current_spent: 720000` while only one transaction (`tx_05: 180000`) is in the initial array.
   - To provide the most seamless experience:
     - If matching transactions exist in the window, their sum is computed.
     - If a budget category has zero transactions in `appState.transactions` but has `budget.current_spent > 0`, the engine can fallback to:
       - Monthly: `budget.current_spent`
       - Weekly: `Math.round(budget.current_spent / 4)`
       - Daily: `Math.round(budget.current_spent / 30)`
     - When new transactions are added or deleted, the transaction aggregation immediately takes over dynamically.

---

## 3. Caveats

1. **Timezone Considerations**:
   - Server runs on Node.js, client runs in browser. Indonesia spans WIB (UTC+7), WITA (UTC+8), and WIT (UTC+9).
   - Per project convention (`calendar.js` and `server.js:getWIBTime()`), TataDana standardizes on `Asia/Jakarta` (WIB) for business day boundaries (`YYYY-MM-DD`).
2. **Transfer Transactions**:
   - `type: 'transfer'` transactions do not count toward category budget expenses (they move funds between wallets and lack a budget category).
3. **Immutability of Existing Tests**:
   - `test_suite.js` (146 tests) verifies `/budget` webhook output and `monthly_limit` expansions. Backend `db.budgets` properties (`id`, `category_id`, `monthly_limit`, `current_spent`) must remain intact.

---

## 4. Conclusion & Recommended Architecture

Decouple the dynamic calculation logic into `public/modules/budget-period.js` (and mirror in `src/modules/budget-period.js` if Node.js unit testing is needed).

### 4.1 Detailed Calculation Specification

| Period | Limit Formula | Spending Scope | Date Filtering Rule |
|---|---|---|---|
| **Harian** (`daily`) | `Math.round(monthly_limit / 30)` | Today's category expenses | `toWibDateKey(tx.date) === toWibDateKey(refDate)` |
| **Mingguan** (`weekly`) | `Math.round(monthly_limit / 4)` | Last 7 days expenses | `refTime - txTime <= 7 * 24 * 3600 * 1000` or today |
| **Bulanan** (`monthly`) | `monthly_limit` | Current calendar month expenses | `toWibDateKey(tx.date).slice(0, 7) === targetMonth` |

### 4.2 Exact Helper Functions & Pseudo-code for Implementation

```javascript
// ====================================================================
// TataDana Fintech SaaS - Dynamic Category Budget Engine (Round 2)
// File: public/modules/budget-period.js
// ====================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TataDanaBudgetPeriod = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Global active period state: 'daily' | 'weekly' | 'monthly'
  let activePeriod = 'monthly';

  /**
   * Normalize any Date or ISO timestamp to YYYY-MM-DD in Asia/Jakarta (WIB)
   */
  function toWibDateKey(dateInput) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    } catch (e) {
      // Fallback for environments without full ICU
      const tzOffset = 7 * 60; // WIB is UTC+7
      const local = new Date(d.getTime() + tzOffset * 60000);
      return local.toISOString().slice(0, 10);
    }
  }

  /**
   * Resolve reference date (explicit date -> latest transaction date -> current time)
   */
  function resolveReferenceDate(referenceDate, transactions = []) {
    if (referenceDate) {
      const d = new Date(referenceDate);
      if (!isNaN(d.getTime())) return d;
    }
    if (Array.isArray(transactions) && transactions.length > 0) {
      const valid = transactions
        .map(t => new Date(t.transaction_date || t.date).getTime())
        .filter(ts => !isNaN(ts));
      if (valid.length > 0) {
        return new Date(Math.max(...valid));
      }
    }
    return new Date();
  }

  /**
   * Check if transaction matches a category budget
   */
  function isCategoryMatch(budget, tx) {
    if (!budget || !tx) return false;
    if (budget.category_id && tx.category_id && budget.category_id === tx.category_id) {
      return true;
    }
    const bName = String(budget.category_name || '').toLowerCase().trim();
    const tName = String(tx.category_name || '').toLowerCase().trim();
    if (bName && tName) {
      if (bName === tName) return true;
      if (bName.includes(tName) || tName.includes(bName)) return true;
    }
    return false;
  }

  /**
   * Dynamic Calculation Engine for a Category Budget
   * @param {Object} budget - Category budget object (monthly_limit, category_id, etc.)
   * @param {string} period - 'daily' | 'weekly' | 'monthly'
   * @param {Array} transactions - Array of transaction objects
   * @param {Date|string} referenceDate - Optional reference date
   * @returns {Object} Calculated metrics
   */
  function calculateCategoryBudget(budget, period = 'monthly', transactions = [], referenceDate = null) {
    const rawLimit = Math.max(0, Number(budget?.monthly_limit) || 0);
    const refDate = resolveReferenceDate(referenceDate, transactions);
    const refTime = refDate.getTime();
    const refDateKey = toWibDateKey(refDate);
    const targetMonth = budget?.month_period || refDateKey.slice(0, 7);

    // 1. Calculate Period Limit
    let limit = 0;
    if (period === 'daily') {
      limit = rawLimit > 0 ? Math.round(rawLimit / 30) : 0;
    } else if (period === 'weekly') {
      limit = rawLimit > 0 ? Math.round(rawLimit / 4) : 0;
    } else {
      limit = rawLimit;
    }

    // 2. Filter Category Expenses
    const matchingExpenses = (transactions || []).filter(t => {
      if (!t || t.type !== 'expense') return false;
      return isCategoryMatch(budget, t);
    });

    // 3. Aggregate Spending by Period
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

    let spent = 0;
    matchingExpenses.forEach(tx => {
      const amt = Math.max(0, Number(tx.amount) || 0);
      const txTime = new Date(tx.transaction_date || tx.date).getTime();
      if (isNaN(txTime)) return;
      const txDateKey = toWibDateKey(tx.transaction_date || tx.date);

      if (period === 'daily') {
        if (txDateKey === refDateKey) {
          spent += amt;
        }
      } else if (period === 'weekly') {
        const isToday = txDateKey === refDateKey;
        const inWindow = (refTime - txTime <= SEVEN_DAYS_MS) && (txTime <= refTime + 60000);
        if (isToday || inWindow) {
          spent += amt;
        }
      } else { // 'monthly'
        if (txDateKey.slice(0, 7) === targetMonth) {
          spent += amt;
        }
      }
    });

    // Fallback if no matching transactions exist but static current_spent is seeded
    if (matchingExpenses.length === 0 && budget && typeof budget.current_spent === 'number' && budget.current_spent > 0) {
      if (period === 'daily') spent = Math.round(budget.current_spent / 30);
      else if (period === 'weekly') spent = Math.round(budget.current_spent / 4);
      else spent = budget.current_spent;
    }

    // 4. Calculate Percentage & Guards against NaN / 0 Division
    let percentage = 0;
    if (limit > 0) {
      const rawPct = (spent / limit) * 100;
      percentage = (!isFinite(rawPct) || isNaN(rawPct)) ? 0 : Math.round(rawPct);
    }

    const progressBarWidth = Math.min(100, Math.max(0, percentage));
    const remaining = Math.max(0, limit - spent);
    const isOverBudget = percentage >= 100;
    const isWarning = percentage >= 80 && percentage < 100;
    const status = isOverBudget ? 'danger' : (isWarning ? 'warning' : 'safe');

    return {
      period,
      monthly_limit: rawLimit,
      limit,
      spent,
      remaining,
      percentage,
      progressBarWidth,
      status,
      isOverBudget,
      isWarning
    };
  }

  /**
   * Calculate all 3 periods at once for a budget category
   */
  function calculateAllPeriods(budget, transactions = [], referenceDate = null) {
    return {
      daily: calculateCategoryBudget(budget, 'daily', transactions, referenceDate),
      weekly: calculateCategoryBudget(budget, 'weekly', transactions, referenceDate),
      monthly: calculateCategoryBudget(budget, 'monthly', transactions, referenceDate)
    };
  }

  /**
   * State Management & UI Binding
   */
  function getActivePeriod() {
    return activePeriod;
  }

  function setActivePeriod(newPeriod) {
    if (['daily', 'weekly', 'monthly'].includes(newPeriod)) {
      activePeriod = newPeriod;
      if (typeof window !== 'undefined') {
        window.activeBudgetPeriod = activePeriod;
        // Trigger UI recalculation and re-render
        if (typeof renderAllCategoryBudgets === 'function') {
          renderAllCategoryBudgets();
        }
      }
    }
  }

  return {
    getActivePeriod,
    setActivePeriod,
    calculateCategoryBudget,
    calculateAllPeriods,
    toWibDateKey,
    resolveReferenceDate,
    isCategoryMatch
  };
}));
```

---

## 5. Verification Method

To independently verify this calculation engine:

1. **Unit Test Verification**:
   Execute the formula assertions against edge cases:
   - Coercion of 0 / negative / non-numeric `monthly_limit`.
   - Zero division guard: `limit = 0` produces `percentage = 0` without `NaN` or `Infinity`.
   - Rounding checks: `Math.round(1000000 / 30) = 33333`, `Math.round(1000000 / 4) = 250000`.
   - Date window filtering: today's date matches daily, 7-day window matches weekly, month key matches monthly.
   - Status checks: `<80%` is `safe`, `80%-99%` is `warning`, `>=100%` is `danger`.

2. **Integration Test Verification**:
   - Run `node test_suite.js` to ensure all 146 existing tests pass with 0 regressions.
   - Verify `node test_wallet_budget.js` passes 100%.

3. **Invalidation Conditions**:
   - Any test where `percentage` returns `NaN` or `null`.
   - Any daily spending calculation that aggregates transactions from prior days.
   - Any failure of existing backend tests or Telegram bot `/budget` command.
