# Project: TataDana Fintech SaaS — Round 2

## Architecture
TataDana is a full-stack personal finance & SaaS platform running on native Node.js (`server.js`) serving an interactive single-page application (`public/index.html`) and modular components (`public/modules/` and `src/modules/`).
Round 2 introduces multi-period budget filtering (Harian, Mingguan, Bulanan) on "Batas Budget per Kategori" across Beranda Keuangan (`#dash-overview`) and Subtab Budget (`#dash-budgets`).

### Synthesized Architectural Blueprint (Verified & Complete):
1. **Modular Encapsulation**: All multi-period logic is implemented in `public/modules/budget-period.js`. It exposes `window.TataDanaBudgetPeriod` and supports Node.js CommonJS `module.exports`.
2. **DOM Container Layout**:
   - Subtab Budget: `#dash-budgets` with existing `#budgets-container` (period selector tabs placed above it).
   - Beranda Keuangan: `#dash-overview` with newly added section `#overview-budgets-section` and `#overview-budgets-container` (period selector tabs placed above it).
   - Prevents DOM ID clobbering and preserves existing selectors for legacy tests.
3. **Timezone Standardization**: Temporal windowing strictly uses `Asia/Jakarta` (WIB) date keys via `Intl.DateTimeFormat`.
4. **State Persistence**: Active period state is preserved in `window.TataDanaBudgetPeriod.activePeriod` so updates/mutations re-render the active period without resetting to default.
5. **Reactive Hooks**: Transaction additions, deletions, or Telegram webhook mutations trigger `TataDanaBudgetPeriod.render()`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Admin Approval System | Interactive approval queue, rejection reasons, 400 on duplicate action, audit trail | M1 | R1 (Completed) |
| 2 | New Wallet & Multi-Period Budget | Dashboard modal form to create wallet, Starter max 3 wallets limit | M2 | R2 (Completed) |
| 3 | Interactive Budget Calendar | Monthly grid calendar with mutation indicators, cashflow summary on click | M3 | R3 (Completed) |
| 4 | In-App "Tata AI Bot" Module | Interactive financial assistant widget with smart savings recommendations | M4 | R4 (Completed) |
| 5 | Telegram Bot NLP & Webhook | Robust parser for complex Indonesian currency formats, income inversion fix | M5 | R5 (Completed) |
| 6 | Time Period Selector Tabs | Interactive tabs (Harian, Mingguan, Bulanan) above Batas Budget per Kategori with orange highlight | M6 | ORIGINAL_REQUEST R1 (DONE) |
| 7 | Dynamic Budget & Spending Calculation | Daily (limit/30, today spend), Weekly (limit/4, 7-day spend), Monthly (full limit, month spend) | M7 | ORIGINAL_REQUEST R2 (DONE) |
| 8 | Progress Bar & Dynamic Alerts | Dynamic percentage, smooth progress bar, formatted text quota, warning (>=80%) & danger (>=100%) badges | M8 | ORIGINAL_REQUEST R3 (DONE) |
| 9 | Reactive State & Test Suite Resilience | Instant tab switching, real-time sync on new transactions (Web & Bot), 100% existing test pass | M9 | ORIGINAL_REQUEST R4 (DONE) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1-M5 Core Advanced Features | Features 1-5 from Round 1 | none | DONE |
| 2 | Survey & Codebase Investigation | 5-agent parallel exploration of frontend DOM, calculation logic, specs, tests, and regressions | none | DONE |
| 3 | M6-M9 Multi-Period Budget Implementation | Implementation of UI tabs, calculation engine, progress bar alerts, reactive state | Survey | DONE |
| 4 | Independent Multi-Agent Verification | Reviewers, Challenger empirical test harness, and Forensic Auditor verification | M6-M9 | DONE |
| 5 | E2E Regression Pass & Sentinel Sign-Off | Full execution of all test suites (671+ tests passing across 10 suites) | Verification | DONE |

## Interface Contracts

### Time Period Selector & State
- Selected period type: `'daily' | 'weekly' | 'monthly'` (Default: `'monthly'`)
- State location: `window.TataDanaBudgetPeriod.activePeriod`
- Active tab styling: `bg-orange-600 text-white font-bold shadow-sm shadow-orange-600/30`
- Inactive tab styling: `bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-orange-500`

### Dynamic Calculation Engine
- Inputs: `budget`, `transactions`, `period = 'monthly'`, `refDate = new Date()`
- Formulas:
  - **Harian (Daily)**:
    - Limit: `Math.round(monthly_limit / 30)`
    - Spending: Sum of expenses in category where transaction date is today in `Asia/Jakarta`.
  - **Mingguan (Weekly)**:
    - Limit: `Math.round(monthly_limit / 4)`
    - Spending: Sum of expenses in category where `txTime >= (refTime - 7 * 86400000) && txTime <= refTime`.
  - **Bulanan (Monthly)**:
    - Limit: `monthly_limit`
    - Spending: Sum of expenses in category in current calendar month (`YYYY-MM`).
- Percentage: `limit > 0 ? Math.round((spending / limit) * 100) : 0` (zero limit safe against `NaN` / `Infinity`).
- Clamped width: `Math.min(100, Math.max(0, percentage))`
- Sisa Kuota: `Math.max(0, limit - spending)`
- Text format: `Rp[formatNumber(spending)] / Rp[formatNumber(limit)] ([percentage]%)`
- Alerts:
  - If `percentage >= 100%`: Over-budget danger alert badge (`🚨 Over-budget! Melebihi limit [periode].`, bar color `bg-rose-500`).
  - If `percentage >= 80% && percentage < 100%`: Warning alert badge (`⚠️ Alert 80% tercapai! Mendekati batas limit.`, bar color `bg-amber-500`).
  - If `percentage < 80%`: Safe (`bg-orange-500`).

## Code Layout & File Boundaries
- Existing frontend: `public/index.html` (owns integration script tag and overview container)
- Modular budget period logic: `public/modules/budget-period.js` (owns calculation engine, rendering, event listeners)
- Test Suites (100% pass across all):
  * `test_budget_period.js` (58 / 58 passed)
  * `test_r2_adversarial_stress.js` (35 / 35 passed)
  * `test_r2_reactive_e2e.js` (passed)
  * `test_suite.js` (146 / 146 passed)
  * `test_wallet_budget.js` (48 / 48 passed)
  * `test_admin_approval.js` (53 / 53 passed)
  * `test_navigation.js` (86 / 86 passed)
  * `test_telegram_polling.js` (25 / 25 passed)
  * `test_adversarial_challenger.js` (168 / 168 passed)
  * `test_challenger_2_adversarial.js` (passed)
  * `test_telegram_m5.js` (39 / 39 passed)
