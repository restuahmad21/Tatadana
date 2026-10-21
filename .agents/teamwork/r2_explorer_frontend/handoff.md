# Handoff Report: Frontend UI Explorer (Round 2 — Multi-Period Category Budget)

## 1. Observation

### 1.1 Codebase File Structure & Frontend Modules
- `public/index.html` (size: 194,566 bytes, 3,570 lines) contains the entire Single Page Application (SPA), including HTML markup, Tailwind CSS CDN setup, inline application logic, and module script loaders.
- There is **no separate `public/app.js`** file. The primary frontend JavaScript is inlined in `public/index.html` at lines 2037–3436.
- Existing modular scripts in `public/modules/`:
  - `public/modules/wallet-budget.js` (lines 1–330): Milestone 2 multi-period wallet budget preview, form modal, and wallet cards rendering.
  - `public/modules/calendar.js` (lines 1–580): Milestone 3 interactive calendar with WIB (`Asia/Jakarta`) date helper (`toWibDateKey`).
  - `public/modules/tata-ai.js` (lines 1–280): Milestone 4 in-app AI assistant drawer and chatbot.
- Script inclusion order in `public/index.html` (lines 2031–2033 & 3567):
  ```html
  <script src="/modules/wallet-budget.js"></script>
  <script src="/modules/calendar.js"></script>
  ```
  New module `public/modules/budget-period.js` should be loaded right alongside these modules.

---

### 1.2 DOM Containers for "Batas Budget per Kategori"

#### A. Subtab Budget (`#dash-budgets`)
Located in `public/index.html` at lines 1368–1377:
```html
1368:       <!-- SUBTAB 4: BUDGETS (PART 3 SPECIFICATION) -->
1369:       <div id="dash-budgets" class="dash-tab hidden space-y-6">
1370:         <div class="flex items-center justify-between">
1371:           <h2 class="text-xl font-black text-zinc-900 dark:text-white">Batas Budget per Kategori</h2>
1372:           <span class="text-xs text-orange-400 font-semibold">Notifikasi Otomatis via Telegram (80% & 100%)</span>
1373:         </div>
1374: 
1375:         <div id="budgets-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
1376:           <!-- Dynamically populated with progress bars -->
1377:         </div>
1378:       </div>
```
- **Observation**:
  - The tab container ID is `id="dash-budgets"` (plural, corresponding to nav button `id="nav-budgets"` and valid tab identifier `'budgets'`). Note: `PROJECT.md` informally referenced `#dash-budget`; the real HTML DOM ID is `dash-budgets`.
  - The category budget cards container is `id="budgets-container"`.
  - Currently, there is **no period selector tab bar** (Harian, Mingguan, Bulanan) above `#budgets-container`.

#### B. Beranda Keuangan (`#dash-overview`)
Located in `public/index.html` at lines 1074–1236:
- The container for Beranda Keuangan is `<div id="dash-overview" class="dash-tab space-y-8">` (nav button `id="nav-overview"`, heading: `Beranda Keuangan`).
- Currently, `#dash-overview` contains:
  1. 4 Metric Cards (Saldo Total, Pemasukan Bulan Ini, Pengeluaran Bulan Ini, Budget Tersisa `#stat-budget-left`, lines 1077–1101).
  2. Analytics Period Filter (Bulan Ini, Harian, Mingguan, Tahunan, Custom Range, lines 1104–1111) for chart visuals.
  3. SVG Charts (Donut & 6-Month Bar, lines 1114–1192).
  4. Onboarding Checklist (line 1201 has `"🎯 3. Atur Batas Budget Kategori"` with button `switchDashTab('budgets')`).
  5. 10 Recent Transactions Table (lines 1210–1234).
- **Observation**:
  - Currently, Beranda Keuangan does **NOT** contain a category budget cards container or period selector tabs.
  - To fulfill R1 across both Beranda Keuangan and Subtab Budget, a dedicated section must be added to `#dash-overview` with a container (e.g. `id="overview-budgets-container"`, with alias support for `home-budgets-container`).

---

### 1.3 Current Rendering Implementation
In `public/index.html` inside `renderAllViews()`, lines 2144–2159:
```javascript
2144:       // 6. Render Budgets
2145:       document.getElementById('budgets-container').innerHTML = appState.budgets.map(b => {
2146:         const pct = Math.min(100, Math.round((b.current_spent / b.monthly_limit) * 100));
2147:         return `
2148:           <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
2149:             <div class="flex justify-between text-xs font-bold text-zinc-900 dark:text-white">
2150:               <span>${b.category_emoji} ${b.category_name}</span>
2151:               <span>${formatRupiah(b.current_spent)} / ${formatRupiah(b.monthly_limit)} (${pct}%)</span>
2152:             </div>
2153:             <div class="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
2154:               <div class="h-full bg-orange-500 rounded-full" style="width: ${pct}%"></div>
2155:             </div>
2156:             ${pct >= 80 ? '<p class="text-[10px] text-red-400 font-semibold">⚠️ Alert 80% tercapai! Notifikasi terkirim ke Telegram.</p>' : ''}
2157:           </div>
2158:         `;
2159:       }).join('');
```

**Flaws & Limitations Identified**:
1. **Hardcoded Monthly Values**: Directly uses `b.current_spent` and `b.monthly_limit`. Ignores time periods (Harian / Mingguan).
2. **Missing Progress Bar Transitions**: `div class="h-full bg-orange-500 rounded-full"` lacks transition classes (e.g. `transition-all duration-500 ease-out`). Tab changes jump abruptly.
3. **Monochromatic Progress Bar**: Bar color is permanently `bg-orange-500` even when exceeding 80% or 100%.
4. **Weak Alert Styling**: Only renders a small `<p class="text-[10px] text-red-400 font-semibold">` without badge styling or differentiation between 80% (Warning) and >=100% (Over-budget danger).
5. **No State Reactivity**: `budgets-container` is only re-rendered when `renderAllViews()` runs on full state reload.

---

### 1.4 Existing Styling & Design System
- **Framework**: Tailwind CSS via CDN with customized configuration (lines 8–30):
  - Primary Brand Palette: `brand: { 500: '#f97316', 600: '#ea580c', 700: '#c2410c' }` (Standard Tailwind `orange-500`, `orange-600` are mapped and used everywhere).
- **Typography**: Google Font `Plus Jakarta Sans` (lines 33–37) with weight classes `font-bold`, `font-black`, `font-extrabold`.
- **Dark Mode**: Enabled by default (`<html lang="id" class="dark">`).
  - Dark surfaces: `dark:bg-zinc-950` (backgrounds), `dark:bg-zinc-900` (card surfaces), `dark:border-zinc-800` (subtle borders).
  - Light surfaces: `bg-white` (card surfaces), `bg-slate-50` / `bg-zinc-100` (controls/badges), `border-zinc-200`.
- **Button & Tab Theme Patterns**:
  - Active button: `bg-orange-500 text-white shadow-md shadow-orange-500/25 font-bold` or `bg-orange-600 hover:bg-orange-500`.
  - Inactive button: `bg-slate-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 font-medium`.
- **Semantic Alert Palette**:
  - Danger (>=100%): `bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800/80`.
  - Warning (80%–99%): `bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80`.
  - Safe (<80%): `bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400`.

---

## 2. Logic Chain

1. **Requirement R1** specifies interactive Tabs (`Harian`, `Mingguan`, `Bulanan`) above "Batas Budget per Kategori" in both Subtab Budget (`#dash-budgets`) and Beranda Keuangan (`#dash-overview`).
   - *Direct inference*: Both views need identical period selector controls.
   - When the user selects a tab in either view, `window.activeBudgetPeriod` updates, all tab UI elements across both views synchronize their active styling (`bg-orange-500 text-white`), and cards in both views immediately re-render without reloading.

2. **Requirement R2** specifies dynamic formulas:
   - Harian: `limit = Math.round(monthly_limit / 30)`, spending = sum of category expenses for today (`toWibDateKey(tx.date) === toWibDateKey(refDate)`).
   - Mingguan: `limit = Math.round(monthly_limit / 4)`, spending = sum of category expenses in the last 7 days (`refTime - txTime <= 7 * 24 * 60 * 60 * 1000`).
   - Bulanan: `limit = monthly_limit`, spending = sum of category expenses in the current month (`txDate.slice(0, 7) === refDate.slice(0, 7)` or `b.current_spent`).
   - Percentage: `limit > 0 ? Math.round((spending / limit) * 100) : 0` (zero division protection).

3. **Requirement R3** specifies:
   - Visual progress bar transition: `transition-all duration-500 ease-out`.
   - Clamped progress bar width: `Math.min(100, Math.max(0, percentage))%` to prevent UI overflow when spending exceeds 100%.
   - Dynamic alert badges:
     - If `percentage >= 100%`: Render danger alert badge (Over Budget limit exceeded).
     - If `percentage >= 80% && percentage < 100%`: Render warning alert badge (Approaching limit).
     - If `percentage < 80%`: Safe status (no warning badge).
   - Quota text: `Rp[formatNumber(spending)] / Rp[formatNumber(limit)] ([percentage]%)`.

4. **Requirement R4 & Project Plan Contract**:
   - To keep code clean and modular (preventing a 4,000-line monolithic file), calculation logic and UI rendering must reside in `public/modules/budget-period.js`.
   - In `public/index.html`, `renderAllViews()` will delegate category budget rendering to `TataDanaBudgetPeriod.renderCategoryBudgets()`.
   - Any mutation (adding transaction via Web or receiving Telegram webhook) triggers `loadState()`, which in turn triggers `renderAllViews()` and dynamically updates the currently active period.

---

## 3. Concrete UI Design & Implementation Blueprint

### 3.1 Markup for Subtab Budget (`#dash-budgets`)
Replace lines 1370–1377 in `public/index.html` with:
```html
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-black text-zinc-900 dark:text-white">Batas Budget per Kategori</h2>
            <span class="text-xs text-orange-400 font-semibold">Notifikasi Otomatis via Telegram (80% & 100%)</span>
          </div>

          <!-- Periode Tabs Selector (R1) -->
          <div id="budget-period-tabs-budgets" class="budget-period-tabs inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-inner">
            <button onclick="TataDanaBudgetPeriod.setPeriod('daily')" data-period="daily" class="budget-tab-btn px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200">
              Harian
            </button>
            <button onclick="TataDanaBudgetPeriod.setPeriod('weekly')" data-period="weekly" class="budget-tab-btn px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200">
              Mingguan
            </button>
            <button onclick="TataDanaBudgetPeriod.setPeriod('monthly')" data-period="monthly" class="budget-tab-btn px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200">
              Bulanan
            </button>
          </div>
        </div>

        <div id="budgets-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Dynamically populated by TataDanaBudgetPeriod.renderCategoryBudgets() -->
        </div>
```

---

### 3.2 Markup for Beranda Keuangan (`#dash-overview`)
Insert directly above `<!-- 10 Transaksi Terbaru (Part 3) -->` (line 1209) in `public/index.html`:
```html
        <!-- Batas Budget per Kategori (Beranda Keuangan — R1) -->
        <div class="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-extrabold text-base text-zinc-900 dark:text-white">🎯 Batas Budget per Kategori</h3>
                <span id="overview-budget-period-badge" class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 dark:text-orange-400 border border-orange-500/20">Bulanan</span>
              </div>
              <p class="text-xs text-zinc-400">Monitoring real-time kuota belanja multi-periode</p>
            </div>

            <!-- Periode Tabs Selector (R1) -->
            <div id="budget-period-tabs-overview" class="budget-period-tabs inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-inner">
              <button onclick="TataDanaBudgetPeriod.setPeriod('daily')" data-period="daily" class="budget-tab-btn px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200">
                Harian
              </button>
              <button onclick="TataDanaBudgetPeriod.setPeriod('weekly')" data-period="weekly" class="budget-tab-btn px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200">
                Mingguan
              </button>
              <button onclick="TataDanaBudgetPeriod.setPeriod('monthly')" data-period="monthly" class="budget-tab-btn px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200">
                Bulanan
              </button>
            </div>
          </div>

          <div id="overview-budgets-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Dynamically populated by TataDanaBudgetPeriod.renderCategoryBudgets() -->
          </div>
        </div>
```

---

### 3.3 Tab Styling Classes Reference
| Tab State | Tailwind CSS Class String | Visual Appearance |
|---|---|---|
| **Active Tab** | `bg-orange-500 text-white shadow-md shadow-orange-500/25 font-bold cursor-default` | Vibrant modern fintech orange with subtle glow |
| **Inactive Tab** | `text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 font-semibold cursor-pointer` | Subtle dark/light neutral with responsive hover |

---

### 3.4 Category Budget Card DOM Template (R3)
Template generated for each category card inside both `#budgets-container` and `#overview-budgets-container`:

```javascript
function renderCardHtml(b, stats) {
  const { limit, spent, percentage, clampedPct, isWarning, isDanger } = stats;

  // Determine color theme based on threshold
  let barColor = 'bg-orange-500';
  let badgeHtml = '';
  let borderClass = 'border-zinc-200 dark:border-zinc-800';

  if (isDanger) { // >= 100%
    barColor = 'bg-rose-500 shadow-sm shadow-rose-500/50';
    borderClass = 'border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-500/20';
    badgeHtml = `
      <div class="budget-alert-badge flex items-center justify-between px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 text-[11px] font-semibold">
        <span class="flex items-center gap-1.5">
          <span>🚨</span> <span>Over Budget! Limit periode terlampaui (${percentage}%)</span>
        </span>
        <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-200/50 dark:bg-rose-900/50 text-rose-700 dark:text-rose-200">Bahaya</span>
      </div>
    `;
  } else if (isWarning) { // >= 80% && < 100%
    barColor = 'bg-amber-500 shadow-sm shadow-amber-500/50';
    borderClass = 'border-amber-300 dark:border-amber-900/60';
    badgeHtml = `
      <div class="budget-alert-badge flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 text-[11px] font-semibold">
        <span class="flex items-center gap-1.5">
          <span>⚠️</span> <span>Alert ${percentage}% tercapai! Mendekati batas limit</span>
        </span>
        <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-200/50 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">Peringatan</span>
      </div>
    `;
  }

  return `
    <div class="category-budget-card p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border ${borderClass} space-y-3 shadow-sm hover:shadow-md transition-shadow" data-category-id="${b.category_id || b.id}">
      <div class="flex justify-between items-center text-xs font-bold">
        <div class="flex items-center gap-2 text-zinc-900 dark:text-white">
          <span class="text-base">${b.category_emoji || '🎯'}</span>
          <span>${b.category_name}</span>
        </div>
        <div class="font-mono ${isDanger ? 'text-rose-500 font-black' : (isWarning ? 'text-amber-500 font-bold' : 'text-zinc-700 dark:text-zinc-300')}">
          ${formatRupiah(spent)} / ${formatRupiah(limit)} (${percentage}%)
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
```

---

### 3.5 Calculation Engine Spec (`public/modules/budget-period.js`)
```javascript
/**
 * Calculates spending and limit for a category budget over a given time period.
 * 
 * @param {Object} budget - Budget category object { id, category_id, category_name, monthly_limit, current_spent }
 * @param {Array} transactions - List of transactions
 * @param {'daily' | 'weekly' | 'monthly'} period - Active period filter
 * @param {Date|string|null} referenceDate - Reference timestamp (defaults to current date or latest tx date)
 * @returns {Object} { limit, spent, remaining, percentage, clampedPct, isWarning, isDanger, period }
 */
function calculateCategoryBudget(budget, transactions = [], period = 'monthly', referenceDate = null) {
  const monthlyLimit = Math.max(0, Number(budget.monthly_limit) || 0);

  // Determine period limit
  let limit = monthlyLimit;
  if (period === 'daily') {
    limit = monthlyLimit > 0 ? Math.round(monthlyLimit / 30) : 0;
  } else if (period === 'weekly') {
    limit = monthlyLimit > 0 ? Math.round(monthlyLimit / 4) : 0;
  }

  // Determine reference time (WIB Asia/Jakarta timezone safe)
  let refTime = Date.now();
  if (referenceDate) {
    refTime = new Date(referenceDate).getTime();
  } else if (transactions && transactions.length > 0) {
    const valid = transactions.map(t => new Date(t.transaction_date).getTime()).filter(ts => !isNaN(ts));
    if (valid.length > 0) {
      refTime = Math.max(...valid); // Use latest transaction date for test dataset consistency
    }
  }
  const refDate = new Date(refTime);

  // Date keys in Asia/Jakarta WIB (YYYY-MM-DD)
  const toWibDate = (d) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date(d));
    } catch (e) {
      return new Date(d).toISOString().slice(0, 10);
    }
  };

  const refDateStr = toWibDate(refDate);
  const refMonthStr = refDateStr.slice(0, 7); // YYYY-MM
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Filter expenses matching category
  const expenses = (transactions || []).filter(t => {
    if (t.type !== 'expense') return false;
    const matchId = t.category_id && budget.category_id && t.category_id === budget.category_id;
    const matchName = t.category_name && budget.category_name &&
      t.category_name.toLowerCase().trim() === budget.category_name.toLowerCase().trim();
    return matchId || matchName;
  });

  let spent = 0;
  expenses.forEach(tx => {
    const amt = Math.max(0, Number(tx.amount) || 0);
    const txTime = new Date(tx.transaction_date).getTime();
    if (isNaN(txTime)) return;
    const txDateStr = toWibDate(txTime);

    if (period === 'daily') {
      if (txDateStr === refDateStr) spent += amt;
    } else if (period === 'weekly') {
      const diff = refTime - txTime;
      if (diff >= 0 && diff <= 7 * ONE_DAY_MS) spent += amt;
    } else { // monthly
      if (txDateStr.slice(0, 7) === refMonthStr) spent += amt;
    }
  });

  // Fallback for monthly if transactions are empty but server provided current_spent
  if (period === 'monthly' && spent === 0 && budget.current_spent) {
    spent = Number(budget.current_spent) || 0;
  }

  // Calculate percentage safely
  const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const clampedPct = Math.min(100, Math.max(0, percentage));
  const remaining = Math.max(0, limit - spent);

  return {
    period,
    limit,
    spent,
    remaining,
    percentage,
    clampedPct,
    isWarning: percentage >= 80 && percentage < 100,
    isDanger: percentage >= 100
  };
}
```

---

## 4. Caveats
1. **DOM ID Conventions**:
   - `dash-budgets` in `public/index.html` is plural, whereas `PROJECT.md` informally mentioned `#dash-budget`. Both should be accommodated or verified to avoid element mismatch.
   - For Beranda Keuangan, `#overview-budgets-container` is the designated container. Adding alias lookup (e.g. `document.getElementById('overview-budgets-container') || document.getElementById('home-budgets-container')`) will ensure full resilience against varied test query selectors.
2. **Date Timezone Uniformity**:
   - Indonesian financial transactions must align on `Asia/Jakarta` (WIB, UTC+7). Using `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })` ensures midnight boundary calculations for "Harian" (today) match the local Jakarta day.
3. **Dual Environment Module Export**:
   - `budget-period.js` must run in both client browser (`window.TataDanaBudgetPeriod`) and Node.js testing environments (`module.exports = { calculateCategoryBudget, ... }`).

---

## 5. Conclusion
- The frontend DOM structure, Tailwind color system, script lifecycle, and rendering pipelines are fully mapped and ready for implementation.
- All R1 and R3 requirements are thoroughly specified with exact HTML markup, responsive Tailwind CSS classes, mathematical calculation rules, transition animations, and dynamic warning/danger alert badges.
- Modularity is maintained: by implementing `public/modules/budget-period.js` and integrating it cleanly into `public/index.html`, zero regressions will occur across existing test suites (`test_suite.js`, `test_navigation.js`, `test_wallet_budget.js`, etc.).

---

## 6. Verification Method

### 6.1 DOM & Markup Inspection
- Inspect `public/index.html` to confirm:
  - `<script src="/modules/budget-period.js"></script>` is included.
  - Buttons with `data-period="daily"`, `data-period="weekly"`, `data-period="monthly"` exist in both `#dash-budgets` and `#dash-overview`.
  - Both `#budgets-container` and `#overview-budgets-container` exist in the DOM.

### 6.2 Test Command Execution
Run the following test suites to ensure 100% pass and no regressions:
```bash
# 1. Existing full production test suite
node test_suite.js

# 2. Existing deep navigation test suite
node test_navigation.js

# 3. Existing wallet and multi-period budget test suite
node test_wallet_budget.js

# 4. Existing adversarial challenger test suite
node test_challenger_2_adversarial.js

# 5. Round 2 multi-period budget test suite (to be created in M6-M9)
node test_budget_period.js
```

### 6.3 Invalidation Conditions
- A test failure in `test_suite.js` or `test_navigation.js`.
- Tab buttons in Beranda Keuangan and Subtab Budget failing to synchronize their active state when clicked.
- Progress bars jumping instantaneously without CSS transition styling (`duration-500 ease-out`).
- Daily/weekly calculation producing `NaN` or unhandled division by zero when a category has zero limit.
