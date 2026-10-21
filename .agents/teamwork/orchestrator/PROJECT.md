# Project: TataDana Fintech SaaS Advanced Features

## Architecture
TataDana is a full-stack Indonesian personal finance & SaaS platform running on native Node.js (`server.js`) serving an interactive single-page application (`public/index.html`) and TypeScript components (`src/`).
To allow 5 specialist workers to work concurrently without merge conflicts or file collisions on `server.js` and `public/index.html`, modular extensions are decoupled into dedicated component scripts:
- Modular frontend extensions live in `public/modules/` or designated modular hooks.
- Modular backend engines live in `src/modules/` or `src/lib/`.
- Integration hooks in `server.js` and `public/index.html` load these modular handlers.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Admin Approval System | Interactive approval queue with status filters (Pending, Approved, Rejected), rejection reason requirement, state machine 400 on duplicate action, balance/plan execution, audit logging | M1 | ORIGINAL_REQUEST R1 |
| 2 | New Wallet & Multi-Period Budget | Dashboard modal form to create wallet with initial balance, type, and budget limit; automatic multi-period utilization (daily, weekly, monthly); Starter plan max 3 wallets limit enforcement | M2 | ORIGINAL_REQUEST R2 |
| 3 | Interactive Budget Calendar | Monthly grid calendar with mutation indicators on dates with transactions, date click filtering with daily cashflow summary (income, expense, net), month navigation | M3 | ORIGINAL_REQUEST R3 |
| 4 | In-App "Tata AI Bot" Module | Interactive financial assistant widget in web dashboard with instant Indonesian response, smart savings recommendations from user transactions, and transaction simulation | M4 | ORIGINAL_REQUEST R4 |
| 5 | Telegram Bot NLP & Webhook Hardening | Robust parser for complex Indonesian currency formats (e.g. '25.500', '12,5jt', '50rb', quantities '2 ayam 25.000'), income inversion fix ('gaji supir' is expense), prevent silent misclassification, semantic idempotency | M5 | ORIGINAL_REQUEST R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Admin Approval System | Verify and strengthen Admin Approval queue, rejection reason validation, duplicate protection 400 error, and audit trail tests | none | DONE |
| 2 | M2: New Wallet & Multi-Period Budget | Implement `#add-wallet-modal`, multi-period budget calculation & display (daily/weekly/monthly), Starter 3-wallet restriction | none | DONE |
| 3 | M3: Interactive Budget Calendar | Implement `#dash-calendar` UI, monthly grid with mutation dots, date selection cashflow summary, month navigation, `/dashboard/calendar` route | none | DONE |
| 4 | M4: In-App "Tata AI Bot" | Implement `#tata-ai-drawer`, floating launcher, `POST /api/ai/chat` backend handler, Indonesian smart savings analysis & simulation | none | DONE |
| 5 | M5: Telegram Bot NLP & Webhook | Implement enhanced `parseIndonesianCurrency`, multi-word token parsing, income inversion protection, webhook semantic deduplication | none | DONE |

## Interface Contracts

### M1: Admin Approval ↔ Backend & Audit
- Endpoint: `GET /api/admin/approvals?status=pending|approved|rejected`
- Endpoint: `POST /api/admin/approvals/action` body: `{ id, action: 'approve'|'reject', note }`
- Rules: If already processed -> HTTP 400. If action is reject -> `note` is mandatory. Real-time balance/plan updates on approve. Audit trail logged to `db.auditLogs`.

### M2: Wallets ↔ Multi-Period Budget
- Endpoint: `POST /api/wallets` body: `{ name, type, balance, budget_limit }`
- Rules: Starter plan allows maximum 3 wallets; 4th wallet returns HTTP 403 with upgrade message.
- Calculation formulas:
  - Daily limit: `budget_limit / 30`
  - Weekly limit: `budget_limit / 4` (or `budget_limit / 4.3`)
  - Monthly limit: `budget_limit`
  - Utilization percentage: `(spent / limit) * 100%`

### M3: Calendar ↔ Transaction Cashflow
- Navigation: Route `/dashboard/calendar`, container `#dash-calendar`, tab `#nav-calendar`.
- Day cell: Date, active indicator dot if date has transactions.
- On date click: Show daily summary: Total Income, Total Expense, Net Cashflow, and list of transactions on selected date.
- Controls: Month selector (Previous Month / Next Month).

### M4: Tata AI Bot ↔ Dashboard & Financial Advisor
- Endpoint: `POST /api/ai/chat` body: `{ message, history }`
- Response: `{ ok: true, reply, suggestions, simulation }`
- Context: Analyzes user's actual transactions to give relevant saving advice in Indonesian.

### M5: Telegram Bot ↔ NLP Parser & Webhook
- Function: `parseIndonesianCurrency(text)` -> extracts nominal correctly even with item quantities (e.g. "beli 2 ayam 25.000" -> 25000, "gaji 12,5jt" -> 12500000, "pulsa 50rb" -> 50000).
- Type classifier: "gaji" without expense indicators -> income; "gaji supir" / "bayar gaji" -> expense.
- Deduplication: Semantic window or update_id hash prevents duplicate transactions within 60 seconds.

## Code Layout & File Boundaries
- M1 owns: `src/modules/admin-approval.js`, admin approval unit/integration tests
- M2 owns: `public/modules/wallet-budget.js`, `src/modules/wallet-budget.js`
- M3 owns: `public/modules/calendar.js`, `src/modules/calendar.js`
- M4 owns: `public/modules/tata-ai.js`, `src/modules/tata-ai.js`
- M5 owns: `src/lib/telegram-nlp.js`, `src/lib/utils.ts`, `src/lib/telegram-engine.ts`
- Shared integration hooks in `server.js` and `public/index.html` are cleanly appended or linked to the modules.
