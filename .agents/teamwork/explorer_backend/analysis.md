# TataDana Fintech SaaS — Backend Architecture & Codebase Discovery Report

## Executive Summary
This document delivers a comprehensive read-only investigation of the backend architecture, data models, APIs, authentication, wallet and budget mechanics, admin approval systems, and automated test frameworks for **TataDana Fintech SaaS**.

The application operates as a full-stack Node.js server with in-memory Supabase emulation in production runtime (`server.js`), backed by complete Supabase PostgreSQL relational migration specifications (`supabase/migrations/001_initial_schema.sql`). 100% of existing test suites (`test_suite.js` with 69 tests and `test_navigation.js` with 74 tests) are currently operational and passing.

---

## 1. Tech Stack & Framework Architecture

### 1.1 Backend Runtime
- **Core Server**: Node.js (v18+/v20+/v24) native HTTP module (`http.createServer`).
- **Primary Server File**: `server.js` (2,138 lines, ~88 KB).
- **Network Interface**: Native `http`, `https`, `url`, `crypto`, `fs`, `path`.
- **Port & Binding**: Configurable via `PORT` environment variable (default: `3000`, binding `0.0.0.0`).
- **Timezone**: Strict **Asia/Jakarta (WIB)** formatting across all date calculations, transactions, reports, and bot replies.
- **Currency Engine**: Indonesian Rupiah (`IDR`) with localized separators (`Rp25.000`, `1.5jt`, `50rb`).

### 1.2 Dual-Architecture Coexistence (Next.js vs server.js)
- `package.json` specifies:
  - `"next": "14.2.15"`, `"react": "^18.3.1"`, `"@supabase/supabase-js": "^2.45.6"`, `"@supabase/ssr": "^0.5.1"`, `"tailwindcss": "^3.4.14"`.
  - Next.js scaffolding exists in `src/app/`, `src/components/`, `src/lib/`.
- **Runtime Execution**:
  - The live operational server tested and run on localhost is `server.js` (`node server.js`).
  - `server.js` handles all `/api/*` endpoints, executes Telegram webhook logic, serves static assets, and performs **SSR pre-activation** of `public/index.html` by parsing requested routes (`/`, `/login`, `/register`, `/dashboard`, `/admin`) and substituting visibility classes directly into the HTML stream before responding.

### 1.3 Multi-AI Engine Architecture
- Configured in `server.js` (`executeAiPipeline`) and database state:
  - **Google Gemini 2.0 Flash** (`gemini-2.0-flash-exp`) - Primary provider.
  - **OpenAI GPT-4o & Whisper** (`gpt-4o-mini`) - Secondary provider / Whisper audio transcription.
  - **DeepSeek V3 / R1** (`deepseek-chat`) - Tertiary failover provider.
- Modes: `single` or `parallel` (automatic failover with priority ranking and latency/cost tracking in `db.aiLogs`).

---

## 2. Database Models & Storage Mechanisms

### 2.1 Supabase PostgreSQL DDL (`supabase/migrations/001_initial_schema.sql`)
The PostgreSQL schema defines 16 relational structures with PostgreSQL enums, triggers, and Row Level Security (RLS):

| Table Name | Primary Key | Description | Key Relationships |
|---|---|---|---|
| `profiles` | `id UUID` | User account profiles linked to `auth.users` | Linked to all user entities |
| `wallets` | `id UUID` | Multi-wallet financial accounts | References `profiles(id)` |
| `categories` | `id UUID` | Income/Expense categories with emoji & color | References `profiles(id)` |
| `budgets` | `id UUID` | Monthly budget allocations per category | References `categories(id)` |
| `transactions` | `id UUID` | Financial transactions (income, expense, transfer) | References `wallets(id)`, `categories(id)` |
| `transaction_items`| `id UUID` | Multi-item receipt breakdowns for Pro OCR | References `transactions(id)` |
| `subscriptions` | `id UUID` | Plan tier (`starter` vs `pro`), monthly quota | References `profiles(id)` |
| `payments` | `id UUID` | Midtrans & manual bank transfer orders | References `profiles(id)` |
| `reminders` | `id UUID` | Daily reminder schedule settings (WIB) | References `profiles(id)` |
| `processed_webhooks`| `update_id BIGINT`| Idempotency store for Telegram webhooks | Unique constraint on `update_id` |
| `ai_providers` | `id UUID` | Superadmin managed AI provider keys & priorities | Managed by superadmin |
| `ai_logs` | `id UUID` | Latency, token count, and failover logs | References `profiles(id)` |
| `audit_logs` | `id UUID` | Superadmin action audit trail | References `profiles(id)` |
| `export_history` | `id UUID` | Generated PDF and Excel report history | References `profiles(id)` |

- **Trigger Function**: `handle_transaction_changes()` executes `AFTER INSERT ON public.transactions`:
  - Automatically deducts/credits `wallets.balance`.
  - Increments `budgets.current_spent` for category expense.
  - Handles source and destination balances for `transfer`.
  - Increments `subscriptions.monthly_transaction_count`.

### 2.2 Active In-Memory Emulation Store (`server.js: getInitialDbState()`)
The backend runtime maintains an in-memory replica `db`:
- `db.user`: Current active session user profile (`usr_tatadana_001` - Budi Pratama).
- `db.allUsers`: Registered user list (`usr_tatadana_001`, `usr_tatadana_002`, `usr_tatadana_003`).
- `db.wallets`: Multi-wallet records (`wal_bca`, `wal_gopay`, `wal_cash`, `wal_mandiri`).
- `db.categories`: 9 default categories (Food, Transport, Entertainment, Utility, Health, Shopping, Education, Salary, Freelance).
- `db.budgets`: Category budgets with `monthly_limit`, `current_spent`, and `month_period`.
- `db.transactions`: 8 seeded transactions across web, telegram text, telegram voice, and receipt OCR.
- `db.subscription`: Plan subscription (`plan: 'pro' | 'starter'`).
- `db.approvals`: Approval request queue.
- `db.auditLogs`: Inspection and action audit records.
- `db.processedWebhooks`: Set of processed `update_id`s for idempotency.

---

## 3. Existing API Routes & Controllers

The backend routing in `server.js` is structured as follows:

| Endpoint | Method | Scope | Functionality & Constraints |
|---|---|---|---|
| `/api/test/reset-state` | `POST` | Testing | Resets in-memory database to initial state. |
| `/api/state` | `GET` | Core | Returns entire user state, wallets, budgets, transactions, approvals. |
| `/api/telegram/webhook` | `POST` | Bot / Public | Webhook with update_id idempotency, NLP parsing, Voice & OCR processing. |
| `/api/telegram/test-connection`| `POST` | Settings | Validates Telegram bot token format, uniqueness, and webhook status. |
| `/api/transactions` | `POST` | User | Records manual web transaction (income/expense/transfer); checks Starter 50 tx limit. |
| `/api/transactions/:id` | `DELETE`| User | Deletes transaction and recalculates wallet balances. |
| `/api/wallets` | `POST` | User | Creates new wallet; enforces Starter max 3 wallets (HTTP 403). |
| `/api/wallets/set-default` | `POST` | User | Sets default wallet for Telegram bot automated logging. |
| `/api/categories` | `POST` | User | Creates custom user category with emoji and color. |
| `/api/budgets` | `POST` | User | Creates or updates category monthly budget; checks Starter max 5 budgets. |
| `/api/settings/profile` | `POST` | User | Updates user display name, phone, and default currency. |
| `/api/settings/reminder` | `POST` | User | Configures daily Telegram notification frequency and WIB schedule. |
| `/api/admin/approvals` | `GET` | Admin | Retrieves approval queue with `?status` and `?category` filters. |
| `/api/admin/approvals/action` | `POST` | Admin | Approves or rejects user requests; enforces state machine & audit log. |
| `/api/admin/approvals` / `/api/approvals/request` | `POST` | Admin/User | Enqueues a new approval item with validation. |
| `/api/admin/payments/status` | `POST` | Admin | Approves manual Midtrans/bank transfer payment; upgrades user to Pro. |
| `/api/admin/audit-logs` | `GET` | Admin | Fetches audit trail and auto-records inspection audit log. |
| `/api/admin/impersonate` | `POST` | Admin | Impersonates user account by `userId` without password re-entry. |
| `/api/admin/export-users` | `GET` | Admin | Streams all user accounts in JSON format. |
| `/api/admin/ai-providers/mode` | `POST` | Admin | Toggles single vs parallel failover AI mode. |
| `/api/admin/ai-providers/toggle`| `POST` | Admin | Toggles active/standby status for specific AI provider. |
| `/api/admin/ai-providers` | `POST` | Admin | Configures provider API key and model name. |
| `/api/auth/login` | `POST` | Auth | Authenticates via Phone+OTP, Email/Password, or Google. |
| `/api/auth/register` | `POST` | Auth | Registers new account with AI onboarding category setup. |
| `/api/reports/exports` | `GET` | Reports | Fetches history of generated downloadable reports. |
| `/api/reports/export/excel` | `GET` | Reports | Generates and streams CSV/Excel report in WIB timezone. |
| `/api/reports/export/pdf` | `GET` | Reports | Generates structured text/PDF financial statement report. |

---

## 4. Admin Panel & Approval System Analysis (Requirement R1)

### 4.1 Current Architecture & Implementation
The approval system is fully active in `server.js` (lines 1383–1736) and covered by integration tests (Tests 43–66c in `test_suite.js`):
1. **Queue Retrieval (`GET /api/admin/approvals`)**:
   - Supports query filtering: `?status=pending|approved|rejected` and `?category=plan_upgrade|wallet_topup|budget_custom`.
   - Returns `{ ok: true, approvals: [...], count: N }`.
2. **State Machine Protection**:
   - Approval requests maintain explicit states: `pending` -> `approved` or `rejected`.
   - Any re-processing attempt on non-pending request returns **HTTP 400**:
     `"Permintaan persetujuan dengan ID ... sudah diproses sebelumnya (status: ...)"`.
   - Prevents double-spending, duplicate wallet credit, and duplicate plan upgrades.
3. **Approval Execution (`POST /api/admin/approvals/action`)**:
   - **`plan_upgrade`**: Updates `targetUser.plan = 'pro'`, updates active session `subscription.plan = 'pro'`, marks linked payment as approved, and logs `approve_plan_upgrade`.
   - **`wallet_topup`**: Adjusts wallet balance (`credit` adds balance, `debit` reduces balance), inserts a new transaction record with note `[Disetujui Admin]`, and logs `approve_wallet_topup`.
   - **`budget_custom`**: Updates existing category `monthly_limit` or inserts new category & budget, and logs `approve_budget_limit` / `approve_custom_category`.
4. **Rejection Execution**:
   - Requires administrative notes (`reason`). If rejected, status is updated to `rejected`, timestamped, and records `reject_<category>` with the mandatory rejection reason in `db.auditLogs`. No balances or plans are altered.
5. **Audit Trail Automation**:
   - Each action creates an immutable log in `db.auditLogs` with `{ id, admin_name, target_user_name, action, details, created_at }`.

---

## 5. Wallet Management & Multi-Period Budget Logic (Requirement R2)

### 5.1 Current Budget & Wallet Mechanics
- **Category-Based Monthly Budget**: Currently, `db.budgets` tracks spending per category per calendar month (`month_period: '2026-10'`).
- **Wallet Model**: Currently contains `{ id, name, type, balance, is_default, is_active }`. Wallets do not yet hold budget limits or multi-period tracking.
- **Starter Plan Enforcement**: `POST /api/wallets` strictly restricts Starter users to **maximum 3 wallets**:
  ```javascript
  if (db.subscription.plan === 'starter' && db.wallets.length >= 3) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: false,
      error: 'Batas maksimal 3 dompet untuk paket Starter tercapai. Upgrade ke Pro untuk dompet unlimited!'
    }));
    return;
  }
  ```

### 5.2 Required Implementation for Multi-Period Budgeting
To fulfill Requirement R2 ("Fitur 'Dompet Baru' Terintegrasi Budget Multi-Periode"):
1. **Wallet Model Enhancement**:
   - Wallets must accept and store a budget configuration:
     - `budget_limit` (or `monthly_budget_limit` as base value).
     - Derived or calculated multi-period limits:
       - **Daily Limit**: `monthly_budget_limit / 30` (or `monthly_budget_limit / daysInMonth`).
       - **Weekly Limit**: `monthly_budget_limit / 4` (or `monthly_budget_limit * 7 / 30`).
       - **Monthly Limit**: `monthly_budget_limit`.
2. **Multi-Period Consumption Calculation**:
   - For any wallet, compute actual expense spending across three sliding or calendar windows:
     - **Daily Spent**: Sum of expenses where `wallet_id === w.id` and `transaction_date` matches today's WIB date (`YYYY-MM-DD`).
     - **Weekly Spent**: Sum of expenses where `wallet_id === w.id` within the past 7 days (or current ISO week).
     - **Monthly Spent**: Sum of expenses where `wallet_id === w.id` within current month (`YYYY-MM`).
3. **Utilization Visualization Metrics**:
   - Calculate percentage consumption:
     - `daily_utilization = (daily_spent / daily_limit) * 100`
     - `weekly_utilization = (weekly_spent / weekly_limit) * 100`
     - `monthly_utilization = (monthly_spent / monthly_limit) * 100`
4. **Starter Plan Guard**:
   - Retain the strict `wallets.length >= 3` check on `POST /api/wallets` with HTTP 403 error and upgrade prompt.

---

## 6. Interactive Calendar & Tata AI Bot Backend Requirements (R3 & R4)

### 6.1 Interactive Calendar (R3) Backend Support
- The existing `/api/state` returns all transactions with ISO date timestamps (`transaction_date`).
- For calendar views, backend endpoint or helper aggregation:
  - Aggregates daily transaction entries for a given month (`YYYY-MM`).
  - Returns per-date data: `{ date: '2026-10-10', total_income, total_expense, transaction_count, items: [...] }`.
  - Determines daily status indicator (e.g. within normal budget vs high spend).

### 6.2 In-App "Tata AI Bot" (R4) Backend Support
- Currently, AI parsing is embedded only inside `executeAiPipeline` for Telegram webhooks.
- An in-app assistant endpoint is needed:
  - `POST /api/ai/chat` or `POST /api/ai/advisor`:
    - Receives user query: `{ message: string, conversation_history?: [] }`.
    - Contextualizes with current user transactions, budget utilization, and wallets.
    - Generates responses in Indonesian with financial advice, spending pattern analysis, and smart logging simulations.
    - Records prompt/completion tokens and latency in `db.aiLogs`.

---

## 7. Telegram Bot NLP Parsing & Webhook Resilience (Requirement R5)

### 7.1 Current Parsing Logic (`parseIndonesianCurrency` in `server.js`)
Currently handles:
1. `jt` / `juta`: `1.5jt`, `1,5 jt`, `12,5jt` -> `Math.round(val * 1000000)`.
2. `rb` / `ribu` / `k`: `15rb`, `50rb`, `25k`, `500k` -> `Math.round(val * 1000)`.
3. Dot/Comma Indonesian Thousands Separator: `17.500`, `25.500`, `1.500.000` -> `parseInt(raw.replace(/[.,]/g, ''))`.
4. `Rp` / `idr` prefix with digits: `Rp 25000`.
5. 4+ digit numbers: `15000`.

### 7.2 Webhook Idempotency & Error Handling
- **Idempotency Protection**: `server.js` maintains `db.processedWebhooks` (`Set<number>`).
  - On incoming webhook, checks if `db.processedWebhooks.has(updateId)`.
  - If present, responds immediately with HTTP 200 `{ ok: true, skipped_reason: 'idempotent_duplicate' }`, preventing double deduction on Telegram webhook retry.
- **Edge-Case Hardening Needed for R5**:
  - Complex multi-word phrases (e.g., `"makan soto 25.500"`, `"gaji freelance 12,5jt"`, `"beli pulsa telkomsel 50rb"`):
    Ensure regex reliably extracts nominal regardless of surrounding words and strips the parsed nominal from the transaction `note` so the resulting note is clean (e.g., `note: "Makan soto"` instead of `"makan soto 25.500"`).
  - Indonesian comma decimals with millions: `"12,5 jt"` vs `"12.5jt"` vs `"12,5jt"`.

---

## 8. Test Framework & Execution Validation

### 8.1 Testing Methodology
TataDana uses a lightweight native Node.js test harness that performs end-to-end HTTP calls against the running application server:
- **Test File 1**: `test_suite.js` (526 lines)
  - 69 test assertions across Parts 1 through 11.
  - Tests API routes, webhook NLP, voice note, photo OCR, idempotency, wallet limits, report generators, AI failover, and Admin approval workflow.
- **Test File 2**: `test_navigation.js` (458 lines)
  - 74 test assertions covering SSR views, URL routing, DOM structure, modals, and admin controls.

### 8.2 Baseline Test Execution Results
Both test suites were executed on the active codebase:
```
node test_suite.js       --> 69 / 69 TESTS PASSED
node test_navigation.js  --> 74 / 74 TESTS PASSED
```
Total baseline verified: **143 / 143 tests passing**.

---

## 9. Recommended Backend Modifications Matrix

| Requirement | Affected Files | Proposed Changes |
|---|---|---|
| **R1. Admin Approval** | `server.js`, `src/lib/types.ts` | Existing approval routes are operational. Verify edge-case validations and audit logging consistency. |
| **R2. Multi-Period Wallet Budget** | `server.js`, `src/lib/types.ts`, `supabase/migrations/001_initial_schema.sql` | Extend wallet model with `budget_limit` / `monthly_budget_limit`. In `POST /api/wallets` and `GET /api/state`, compute daily (`/30`), weekly (`/4`), and monthly limits & actual expense consumption. Retain Starter max 3 wallets limit. |
| **R3. Interactive Calendar** | `server.js` | Add `/api/transactions/calendar` endpoint or format calendar metrics in `/api/state` for per-day cashflow grouping and budget tracking. |
| **R4. Tata AI Bot** | `server.js`, `src/lib/types.ts` | Add `POST /api/ai/chat` endpoint hooked into `executeAiPipeline` to provide contextual financial advice, transaction simulation, and savings tips. |
| **R5. Telegram Bot NLP** | `server.js` | Refine `parseIndonesianCurrency` and `parseStructuredText` to cleanly extract complex Indonesian nominals (`25.500`, `12,5jt`, `50rb`) and isolate transaction descriptions without nominal pollution. |

---

## Conclusion
The backend architecture is clean, fast, and verified with 143 passing tests. The transition to support multi-period budgeting, in-app AI advisory, calendar analytics, and enhanced NLP requires targeted enhancements to `server.js` while maintaining backward compatibility with all existing test assertions.
