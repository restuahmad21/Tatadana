# Handoff Report: Specification & Acceptance Contract for Round 2 Multi-Period Budget

**Agent**: r2_spec_miner  
**Role**: Specification & Contract Miner  
**Project**: TataDana Fintech SaaS (Round 2)  
**Parent Orchestrator ID**: `63f6e4d4-5f76-4523-833c-cde76b7c3560`  
**Timestamp**: 2026-10-17T03:05:00Z  

---

## 1. Observation

Direct observations from the authoritative specifications, project codebase, and existing test suites:

1. **Authoritative Requirements**:
   - `ORIGINAL_REQUEST.md` (lines 55–103, timestamp `2026-10-17T02:54:43Z`):
     - Demands time-period filtering (Harian, Mingguan, Bulanan) on "Batas Budget per Kategori" across Beranda Keuangan and Subtab Budget.
     - Mandates interactive tabs selector UI with clear active tab highlight (modern fintech orange).
     - R2 specifies exact formulas:
       - **Harian**: `Math.round(monthly_limit / 30)` and spending sum from today's category expenses.
       - **Mingguan**: `Math.round(monthly_limit / 4)` and spending sum from last 7 days / weekly expenses.
       - **Bulanan**: `monthly_limit` and spending sum from current calendar month.
     - R3 specifies progress bar and alert indicators:
       - Percentage formula: `(pengeluaran_periode / limit_periode) * 100%`.
       - Text formatting: `Rp[pengeluaran] / Rp[limit] ([persentase]%)`.
       - Dynamic badges: >= 80% warning alert and >= 100% over-budget alert based on active period.
     - R4 specifies reactive state & test suite stability:
       - Instant tab switching without full page reload.
       - Real-time mutation synchronization when transactions are added (via Web modal or Telegram Bot webhook).
       - 100% compatibility across existing test suites (`test_suite.js`, `test_wallet_budget.js`, `test_navigation.js`, etc.).

2. **Architecture and Project Plan**:
   - `PROJECT.md` (lines 18–21, 34–58, 60–65):
     - Feature 6: Time Period Selector Tabs (M6).
     - Feature 7: Dynamic Budget & Spending Calculation (M7).
     - Feature 8: Progress Bar & Dynamic Alerts (M8).
     - Feature 9: Reactive State & Test Suite Resilience (M9).
     - Modular file target: `public/modules/budget-period.js`.
     - Global state: `window.activeBudgetPeriod` / `TataDanaBudgetPeriod.getActivePeriod()`.
     - Default active period: `'monthly'` (`'bulanan'`).

3. **Current Codebase State**:
   - In `public/index.html` (lines 1368–1377), Subtab Budget (`#dash-budgets`) currently contains only a header and `#budgets-container`:
     ```html
     <div id="dash-budgets" class="dash-tab hidden space-y-6">
       <div class="flex items-center justify-between">
         <h2 class="text-xl font-black text-zinc-900 dark:text-white">Batas Budget per Kategori</h2>
         <span class="text-xs text-orange-400 font-semibold">Notifikasi Otomatis via Telegram (80% & 100%)</span>
       </div>
       <div id="budgets-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
     ```
   - In `public/index.html` (lines 2144–2159), `renderBudgets()` computes static monthly percentage using static `b.current_spent / b.monthly_limit`:
     ```javascript
     const pct = Math.min(100, Math.round((b.current_spent / b.monthly_limit) * 100));
     ```
     It does not support period switching, does not aggregate actual category transaction expenses per period, and lacks a >= 100% over-budget distinction.
   - In `public/index.html` (lines 1074–1235), Beranda Keuangan (`#dash-overview`) currently lacks the category budget list widget; it only contains a top stat card (`#stat-budget-left`).
   - In `public/modules/wallet-budget.js` (lines 9–65) and `src/modules/wallet-budget.js` (lines 8–83), the multi-period calculation pattern (`limit/30`, `limit/4`, `limit`) was successfully implemented for wallets in Round 1, providing a proven precedent for date-window filtering (`refTime - txTime <= 7 * ONE_DAY_MS`).
   - In `test_suite.js` (146 tests) and `test_navigation.js` (86 tests), all tests currently pass 100%.

---

## 2. Logic Chain

1. **Requirement Derivation**:
   - Users must be able to switch time scales to monitor category budgets at daily, weekly, and monthly granularity.
   - Because users look at their financial health both on Beranda Keuangan (overview) and the dedicated Budget tab, the selector tabs and category budget cards must be available and synchronized in both locations or seamlessly linked.
   - Default tab must be `'monthly'` to preserve initial user expectations and backward compatibility with Round 1 monthly limit definitions.

2. **Mathematical Precision & Rounding**:
   - `Math.round(monthly_limit / 30)` for daily and `Math.round(monthly_limit / 4)` for weekly ensures clean integer Rupiah figures without fractional cents (e.g., `Rp1.000.000` -> daily `Rp33.333`, weekly `Rp250.000`).
   - Sisa kuota (remaining budget) must be clamped using `Math.max(0, limit - spending)` to avoid negative remaining budget numbers.
   - Division by zero guard: if `limit <= 0`, percentage must evaluate to `0` and remaining to `0`, preventing `NaN` or `Infinity`.
   - Percentage calculation: `limit > 0 ? Math.round((spending / limit) * 100) : 0`.
   - Progress bar width in CSS must be clamped to `Math.min(100, Math.max(0, percentage))%` to prevent broken UI layouts when overspending occurs, while the text quota displays the true percentage (e.g., `(125%)`).

3. **Date Filtering Logic (WIB / Asia-Jakarta)**:
   - All transactions have ISO timestamps with offset (e.g. `2026-10-10T12:15:00+07:00`).
   - Daily spending must match the calendar date of the reference date (today in WIB).
   - Weekly spending must match transactions within 7 days (`txTime >= refTime - 7 * 24 * 60 * 60 * 1000 && txTime <= refTime`).
   - Monthly spending must match the current calendar month (`txDate.getFullYear() === refDate.getFullYear() && txDate.getMonth() === refDate.getMonth()`).
   - Income transactions (`type === 'income'`) and non-matching categories must be strictly excluded.

4. **Alert Thresholds Contract**:
   - `< 80%`: Normal status (no warning, progress bar orange `#f97316` or emerald).
   - `>= 80% && < 100%`: Warning alert badge (Amber badge: `⚠️ Alert 80% tercapai! Mendekati batas limit.`).
   - `>= 100%`: Over-budget alert badge (Rose/Red badge: `🚨 Over-budget! Melebihi limit periode ini.`).
   - Alert states are strictly dynamic: switching tabs recalculates the threshold against the active period's limit and spending immediately.

5. **Reactivity & Synchronization**:
   - Switching tabs must trigger an immediate in-memory re-render without network round-trips or page reload.
   - Adding a transaction from the Web form or receiving a webhook update from Telegram bot mutates `appState.transactions`, which must immediately re-execute the active budget calculation engine.

---

## 3. Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | UI / Tabs | Multi-Period Tab Selector | 3-tab toggle buttons (Harian, Mingguan, Bulanan) above Batas Budget per Kategori | User click or active period state | Active tab highlighted in modern fintech orange, triggers re-render | Fallback to 'monthly' if invalid period passed | ORIGINAL_REQUEST R1, PROJECT.md M6 |
| 2 | UI / Placement | Dual-View Budget Rendering | Category budget list accessible with period filter on both Subtab Budget and Beranda Keuangan | DOM containers `#dash-budgets` & `#dash-overview` | Rendered category budget cards with active period | Graceful fallback if container missing | ORIGINAL_REQUEST R1, PROJECT.md |
| 3 | Calculation | Daily Budget Calculation | Daily limit (`Math.round(limit/30)`) & spending from today's expenses | `monthly_limit`, `transactions`, `category_id`, `refDate` | `{ limit, spent, remaining, percentage }` | Returns 0 for limit/percentage if limit <= 0 | ORIGINAL_REQUEST R2, PROJECT.md M7 |
| 4 | Calculation | Weekly Budget Calculation | Weekly limit (`Math.round(limit/4)`) & spending from last 7 days | `monthly_limit`, `transactions`, `category_id`, `refDate` | `{ limit, spent, remaining, percentage }` | Returns 0 for limit/percentage if limit <= 0 | ORIGINAL_REQUEST R2, PROJECT.md M7 |
| 5 | Calculation | Monthly Budget Calculation | Full monthly limit (`monthly_limit`) & spending from current month | `monthly_limit`, `transactions`, `category_id`, `refDate` | `{ limit, spent, remaining, percentage }` | Returns 0 for limit/percentage if limit <= 0 | ORIGINAL_REQUEST R2, PROJECT.md M7 |
| 6 | Visualization | Dynamic Progress Bar | Visual bar indicating consumption proportion (0% to 100%) | `percentage` | CSS width `min(100, pct)%` with smooth transition | Clamped between 0% and 100% in CSS | ORIGINAL_REQUEST R3, PROJECT.md M8 |
| 7 | Visualization | Quota Text Formatting | Standardized text format `Rp[pengeluaran] / Rp[limit] ([persentase]%)` | `spent`, `limit`, `percentage` | Formatted string with Indonesian locale dots | Displays `Rp0` if values are 0 or empty | ORIGINAL_REQUEST R3, PROJECT.md M8 |
| 8 | Visualization | Multi-Tier Dynamic Alerts | Warning badge for >=80% and Over-budget danger badge for >=100% | Active period `percentage` | Visual badge and text alert under budget card | No alert badge shown if <80% | ORIGINAL_REQUEST R3, PROJECT.md M8 |
| 9 | State / Reactivity | Instant Client Tab Switch | Zero-reload active period state mutation | `activeBudgetPeriod` state variable | Immediate DOM update | State retains previous valid value on error | ORIGINAL_REQUEST R4, PROJECT.md M9 |
| 10 | State / Reactivity | Real-Time Mutation Hook | Auto recalculation on new transactions from Web or Telegram Bot | New transaction event / webhook update | Live update of all category budget cards | Idempotent handling; skips malformed entries | ORIGINAL_REQUEST R4, PROJECT.md M9 |
| 11 | Architecture | Modular Period Module | Decoupled client module `public/modules/budget-period.js` | Loaded via `<script>` tag in `index.html` | Exported `TataDanaBudgetPeriod` object | Isomorphic CommonJS export for headless tests | PROJECT.md § Architecture |

---

## 4. Acceptance Criteria Matrix

### 4.1 UI Component & Selector Specification
- **Component ID / Class**:
  - Period tabs container: `#budget-period-tabs` (in Subtab Budget) and `#overview-budget-period-tabs` (in Beranda Keuangan).
  - Individual tab buttons:
    - Daily: `data-period="daily"`, label: `"Harian"`
    - Weekly: `data-period="weekly"`, label: `"Mingguan"`
    - Monthly: `data-period="monthly"`, label: `"Bulanan"`
- **Default State**:
  - `activeBudgetPeriod = 'monthly'`
  - "Bulanan" tab has active highlight on initial load.
- **Active Tab Styling (Modern Fintech Orange)**:
  - Active: `bg-orange-600 text-white font-bold shadow-sm shadow-orange-600/30`
  - Inactive: `bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-orange-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 font-medium`
- **Location**:
  - Positioned directly above `budgets-container` in `#dash-budgets`.
  - Positioned directly above category budget list in `#dash-overview`.

### 4.2 Exact Mathematical Formulas & Rounding Rules
| Metric | Period: Harian (Daily) | Period: Mingguan (Weekly) | Period: Bulanan (Monthly) |
|---|---|---|---|
| **Limit Formula** | `Math.round(monthly_limit / 30)` | `Math.round(monthly_limit / 4)` | `monthly_limit` |
| **Spending Filter** | `type === 'expense' && category_id === b.category_id && isSameDay(txDate, refDate)` | `type === 'expense' && category_id === b.category_id && txTime >= (refTime - 7 * 86400000) && txTime <= refTime` | `type === 'expense' && category_id === b.category_id && isSameMonth(txDate, refDate)` |
| **Utilization %** | `limit > 0 ? Math.round((spending / limit) * 100) : 0` | `limit > 0 ? Math.round((spending / limit) * 100) : 0` | `limit > 0 ? Math.round((spending / limit) * 100) : 0` |
| **Remaining (Sisa)** | `Math.max(0, limit - spending)` | `Math.max(0, limit - spending)` | `Math.max(0, limit - spending)` |
| **Progress Bar Width** | `Math.min(100, Math.max(0, percentage))%` | `Math.min(100, Math.max(0, percentage))%` | `Math.min(100, Math.max(0, percentage))%` |
| **Text Display** | `Rp[formatNumber(spending)] / Rp[formatNumber(limit)] ([pct]%)` | `Rp[formatNumber(spending)] / Rp[formatNumber(limit)] ([pct]%)` | `Rp[formatNumber(spending)] / Rp[formatNumber(limit)] ([pct]%)` |

### 4.3 Alert Thresholds & Visual Status Contract
| Threshold Condition | Alert Status | Badge / Text Indicator | Bar Color |
|---|---|---|---|
| `percentage >= 100%` | **Over-Budget (Danger)** | `🚨 Over-budget! Melebihi limit [Harian/Mingguan/Bulanan].` (Red badge / text `text-rose-500 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20`) | `bg-rose-500` |
| `percentage >= 80% && percentage < 100%` | **Warning Alert** | `⚠️ Alert 80% tercapai! Mendekati batas limit [Harian/Mingguan/Bulanan].` (Amber badge / text `text-amber-500 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20`) | `bg-amber-500` |
| `percentage < 80%` | **Normal / Safe** | No alert badge displayed (clean normal card status) | `bg-orange-500` |

### 4.4 Reactive State & Mutation Synchronization Contract
1. **Zero-Reload Tab Switching**:
   - Clicking tab `switchBudgetPeriod(period)` updates `window.activeBudgetPeriod` and immediately executes re-rendering function `renderCategoryBudgets()`.
   - Both Beranda Keuangan and Subtab Budget reflect the newly selected active period.
2. **Transaction Addition Synchronization (Web Form)**:
   - When user submits modal `#add-tx-form`, on success response, `loadState()` or local state append is triggered, which invokes `renderCategoryBudgets(activePeriod)`.
3. **Transaction Addition Synchronization (Telegram Bot)**:
   - When `/api/telegram/webhook` records a new expense transaction, background polling / state refresh triggers `renderCategoryBudgets(activePeriod)`.
4. **Transaction Deletion Synchronization**:
   - Calling `deleteTx(id)` removes transaction and invokes `renderCategoryBudgets(activePeriod)`.

---

## 5. Edge Cases Table

| # | Feature | Input / Condition | Observed / Mandated Behavior |
|---|---------|-------------------|------------------------------|
| 1 | Dynamic Limit | `monthly_limit = 0` | Daily limit is `0`, weekly limit is `0`, monthly limit is `0`. Percentage is `0%` (safe against `0/0` NaN). |
| 2 | Dynamic Limit | `monthly_limit < 0` (Negative) | Clamped safely via `Math.max(0, monthly_limit)` to `0`. |
| 3 | Dynamic Limit | `monthly_limit` is non-numeric string or `null` | Sanitized with `Number(limit) || 0`, yielding `0` without runtime exceptions. |
| 4 | Spending Calculation | Non-clean division multiples (e.g., `1.000.000`) | Daily: `Math.round(1000000 / 30) = 33333`. Weekly: `Math.round(1000000 / 4) = 250000`. |
| 5 | Spending Calculation | Non-clean division multiples (e.g., `1.500.000`) | Daily: `Math.round(1500000 / 30) = 50000`. Weekly: `Math.round(1500000 / 4) = 375000`. |
| 6 | Spending Calculation | Huge budget limit (e.g., Rp10.000.000.000 / 10 Miliar) | Daily: `333333333`. Weekly: `2500000000`. Formatted cleanly with dots: `Rp333.333.333`. |
| 7 | Spending Filtering | Income transactions in category | Filter strictly matches `type === 'expense'`. Income transactions are completely ignored. |
| 8 | Spending Filtering | Expense in different category | Filter strictly matches `category_id`. Other categories' expenses are excluded. |
| 9 | Spending Filtering | Transactions with invalid timestamp (`NaN`) | Filtered out via `isNaN(new Date(t.transaction_date).getTime())` without crashing. |
| 10 | Spending Filtering | Weekly window edge: transaction exactly 7 days ago (to the millisecond) | Included in weekly total (`refTime - txTime <= 7 * 24 * 60 * 60 * 1000`). |
| 11 | Spending Filtering | Weekly window edge: transaction 7 days and 1 second ago | Excluded from weekly total (`refTime - txTime > 7 * 86400000`). |
| 12 | Spending Filtering | Daily window edge: transaction from yesterday at 23:59:59 WIB | Excluded from daily total; only transactions matching today's calendar date are included. |
| 13 | Spending Filtering | Future-dated transaction (`txTime > refTime`) | Ignored or filtered so future transactions don't pollute historical calculations. |
| 14 | Progress Bar | Spending exceeds 100% (Over-budget, e.g. 150%) | Progress bar CSS width clamped to `100%` (`style="width: 100%"`), text quota displays `(150%)`, and `🚨 Over-budget` badge is active. |
| 15 | Progress Bar | Zero spending (`0%`) | Progress bar width is `0%`, text quota displays `Rp0 / Rp[limit] (0%)`, no alert badge. |
| 16 | Alert Threshold | Exact boundary: 79.9% / 80.0% | `79%` displays normal (no alert); `80%` displays Warning alert badge (`⚠️ Alert 80% tercapai!`). |
| 17 | Alert Threshold | Exact boundary: 99.9% / 100.0% | `99%` displays Warning alert badge; `100%` displays Over-budget alert badge (`🚨 Over-budget!`). |
| 18 | Alert Threshold | Period-dependent threshold change | Category may be 30% on Monthly (no alert), but 90% on Daily (triggers 80% alert). Switching tabs switches alert badge state instantly. |
| 19 | UI Rendering | Empty `budgets` array (`[]`) | Renders friendly empty state: "Belum ada batas budget kategori yang dikonfigurasi" instead of crashing. |
| 20 | State Switching | Rapid clicking across tabs | Handled synchronously in memory; no race conditions or stale async states. |

---

## 6. Caveats

1. **Reference Date in Production vs Test**:
   - In production browser, reference date defaults to `new Date()`. In test harnesses using seeded historical transactions (e.g. October 2026), the engine should support an optional `referenceDate` parameter (falling back to latest transaction date if available, just like `wallet-budget.js`).
2. **Category ID vs Name**:
   - Seeded transactions contain both `category_id` (e.g. `cat_makanan`) and `category_name` (e.g. `Makanan & Minuman`). Budget calculation should match either `b.category_id === t.category_id || b.category_name === t.category_name` for maximum resilience.
3. **No Caveats Beyond Above**:
   - All other requirements and behavioral boundaries are completely specified.

---

## 7. Conclusion

The specification and contract for TataDana Round 2 (M6–M9) is complete and unambiguous:
- **R1 UI Tabs**: 3-tab selector (Harian, Mingguan, Bulanan) with fintech orange highlight (`#f97316`), default Bulanan, placed in both `#dash-budgets` and `#dash-overview`.
- **R2 Calculation**: Exact formulas (`limit/30`, `limit/4`, `monthly_limit`), date-filtered expenses, safe rounding (`Math.round`), and division-by-zero protection.
- **R3 Progress Bar & Alerts**: Dynamic width (0–100%), formatted text `Rp[pengeluaran] / Rp[limit] ([persentase]%)`, and dual-level alert thresholds (>=80% warning, >=100% over-budget).
- **R4 Reactive State**: Seamless client-side tab switching without page reload, real-time sync upon new transaction additions (Web & Bot), and zero regressions across existing test suites.

---

## 8. Verification Method

To independently verify the specification against the implementation:

1. **Automated Unit & E2E Test Suite**:
   Execute the dedicated Round 2 test suite:
   ```powershell
   node test_budget_period.js
   ```
   *Verification criteria*: All tests covering R1 (UI tabs presence & classes), R2 (daily/weekly/monthly formulas & edge cases), R3 (progress bar clamping & alerts), and R4 (reactive state switching) must pass.

2. **Existing Regression Test Verification**:
   Execute all existing test suites:
   ```powershell
   node test_suite.js
   node test_wallet_budget.js
   node test_navigation.js
   node test_admin_approval.js
   ```
   *Verification criteria*: 100% pass across all test suites with 0 regressions.

3. **DOM & Code Inspection**:
   - Inspect `public/index.html` to confirm tabs selector markup above "Batas Budget per Kategori".
   - Inspect `public/modules/budget-period.js` to confirm functions:
     - `calculateCategoryBudgetStats(budget, transactions, referenceDate)`
     - `switchBudgetPeriod(period)`
     - `getActiveBudgetPeriod()`
     - `renderCategoryBudgets()`
