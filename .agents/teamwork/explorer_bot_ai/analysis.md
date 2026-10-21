# TataDana Fintech SaaS — Telegram Bot & AI Module Technical Analysis

**Author**: Telegram Bot & AI Module Explorer  
**Date**: 2026-10-12  
**Target System**: TataDana Fintech SaaS (Node.js Server, Next.js / TypeScript App, Supabase Database)  
**Status**: Completed Investigation  

---

## 1. Executive Summary

TataDana is designed as an automated personal financial SaaS where users can record transactions with zero friction via Telegram chats (text, voice note, photo receipt) or the web dashboard. 

Our investigation uncovered critical structural characteristics:
1. **Dual Implementation Duality**: There are currently two independent implementations of the Telegram bot logic:
   - **Backend Server (`server.js`)**: A native Node.js HTTP server running on port 3000 handling `/api/telegram/webhook` with an in-memory database and emulated multi-provider AI pipeline.
   - **Client-Side Simulation (`src/lib/telegram-engine.ts` + `TelegramSimulatorModal.tsx`)**: A pure TypeScript implementation that runs entirely inside the browser using `localStorage`.
2. **Severe Parser Vulnerabilities**:
   - The client-side parser in `src/lib/utils.ts` has a catastrophic digit-stripping bug: multi-word inputs like `"beli 2 ayam 25.000"` combine `2` and `25000` into `225000` (Rp225.000).
   - Silent misclassifications abound: non-matching expenses silently default to "Makanan & Minuman", and `"gaji supir 1.5jt"` is inverted into *Income* instead of *Expense*.
   - The word `"juta"` fails to match in the client parser (only `"jt"` matches), causing `"gaji 2 juta"` to parse as Rp2!
3. **Idempotency & Deduplication Gaps**:
   - Webhook idempotency in `server.js` relies strictly on an ephemeral in-memory `Set`. When `update_id` is omitted, the server generates a random ID, completely disabling deduplication.
   - `telegram-engine.ts` has zero idempotency or transaction deduplication.
4. **Tata AI In-App Assistant is Completely Missing**:
   - While the database schema and admin panel support AI provider management (Gemini, OpenAI, DeepSeek), there is **no In-App Tata AI widget or conversational assistant** in the dashboard UI.
   - AI Advisory is currently only an append-only text snippet returned in Telegram replies for Pro users.
5. **Architectural Unification Opportunity**:
   - Both the Telegram bot and the forthcoming In-App Tata AI widget can share a single, unified Financial Intelligence Core that performs context synthesis, Indonesian NL parsing, transaction simulation, and savings advice.

---

## 2. Bot Code Location & Message Ingestion Mechanism

### 2.1 Code Locations

| Component | File Path | Role | State Storage |
|---|---|---|---|
| **Backend Webhook & Bot API** | `server.js` (lines 741–946) | Handles incoming Telegram HTTP POST webhook requests | In-memory `db` object (resettable via `/api/test/reset-state`) |
| **Bot Setup & Connection API** | `server.js` (lines 951–1013) | Validates bot token format, uniqueness, and generates webhook URL | `db.allUsers`, `db.user.custom_bot_token` |
| **Client Telegram Engine** | `src/lib/telegram-engine.ts` (lines 1–364) | Client-side transaction processor and command handler | `localStorage` via `src/lib/store.ts` (`AppState`) |
| **Client Telegram Simulator** | `src/components/TelegramSimulatorModal.tsx` | React modal UI allowing users to test bot chat in Next.js | Calls `processTelegramMessage()` |
| **Public HTML Bot Simulator** | `public/index.html` (lines 80–135, 2649–2687) | Vanilla JS modal `#bot-modal` | Sends `POST /api/telegram/webhook` to `server.js` |
| **Supabase Relational Schema** | `supabase/migrations/001_initial_schema.sql` | Table definitions: `profiles`, `transactions`, `processed_webhooks`, `ai_providers`, `ai_logs` | PostgreSQL / Supabase |

### 2.2 Ingestion Mechanism: Webhook vs. Polling

- **Current Mechanism: Strict Webhook Architecture**
  - Messages are received **only via HTTP POST** to `/api/telegram/webhook`.
  - There is **no Long Polling worker** (no `getUpdates` daemon or polling loop running in `server.js`).
  - Telegram Bot API registers the webhook via `POST /api/telegram/test-connection` which yields `${WEBHOOK_BASE_URL}/api/telegram/webhook`.
- **Payload Structure**:
  ```json
  {
    "update_id": 100918231,
    "message": {
      "message_id": 42,
      "from": { "id": 849302194, "first_name": "Budi" },
      "chat": { "id": 849302194, "type": "private" },
      "date": 1728562500,
      "text": "Beli nasi padang 25rb",
      "voice": { "duration": 5, "file_id": "..." },
      "photo": [{ "file_id": "..." }]
    },
    "isVoiceNote": false,
    "isPhotoReceipt": false,
    "voiceDuration": 5
  }
  ```
- **Execution Flow**:
  1. Payload arrives at `server.js:741`.
  2. Idempotency check checks `db.processedWebhooks.has(updateId)`.
  3. Feature gate checks (Pro-only photo receipt, 60-second voice limit, Starter 50-tx monthly limit).
  4. Bot Command router checks (`/saldo`, `/budget`, `/hari ini`, `/minggu ini`, `/bulan ini`, `/sheet`, `/bantuan`).
  5. AI LLM pipeline execution via `executeAiPipeline()`.
  6. Default wallet & category budget mutations.
  7. Formatted Indonesian WIB response returned synchronously in JSON `{ ok: true, reply_text: "...", transaction: {...} }`.

---

## 3. Natural Language Parser & Indonesian Format Vulnerabilities

### 3.1 Comparison of Parser Implementations

There are currently **two distinct parsing implementations** with diverging regex rules:

#### Implementation 1: `server.js` (`parseIndonesianCurrency`, lines 473–514)
```javascript
function parseIndonesianCurrency(text) {
  if (!text) return null;
  const str = text.trim();
  // 1. Juta / jt
  const jtMatch = str.match(/(?:rp\.?\s*|idr\s*)?(\d+(?:[.,]\d+)?)\s*(?:jt|juta|million)\b/i);
  if (jtMatch) return Math.round(parseFloat(jtMatch[1].replace(',', '.')) * 1000000);
  // 2. Ribu / rb / k
  const rbMatch = str.match(/(?:rp\.?\s*|idr\s*)?(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
  if (rbMatch) return Math.round(parseFloat(rbMatch[1].replace(',', '.')) * 1000);
  // 3. Dot separator
  const sepMatch = str.match(/(?:rp\.?\s*|idr\s*)?(\d{1,3}(?:[.,]\d{3})+(?:,-\b|\b))/i);
  if (sepMatch) return parseInt(sepMatch[1].replace(/[.,]/g, '').replace(',-', ''), 10);
  // 4. Rp prefix
  const rpMatch = str.match(/(?:rp\.?\s*|idr\s*)(\d+)/i);
  if (rpMatch) return parseInt(rpMatch[1], 10);
  // 5. Plain number (4+ digits)
  const numMatch = str.match(/\b(\d{4,})\b/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return null;
}
```

#### Implementation 2: `src/lib/utils.ts` (`parseIndonesianCurrency`, lines 75–100)
```typescript
export function parseIndonesianCurrency(text: string): number | null {
  const clean = text.toLowerCase().replace(/\s+/g, '');
  // Check jt
  const jtMatch = clean.match(/([0-9]+([.,][0-9]+)?)\s*jt/);
  if (jtMatch) return Math.round(parseFloat(jtMatch[1].replace(',', '.')) * 1000000);
  // Check rb / ribu / k
  const rbMatch = clean.match(/([0-9]+([.,][0-9]+)?)\s*(rb|ribu|k)/);
  if (rbMatch) return Math.round(parseFloat(rbMatch[1].replace(',', '.')) * 1000);
  // Pure digits fallback
  const digitsMatch = clean.replace(/[^0-9]/g, '');
  if (digitsMatch.length > 0) return parseInt(digitsMatch, 10);
  return null;
}
```

### 3.2 Vulnerability Matrix

| Test Input Scenario | Expected Behavior | `src/lib/utils.ts` (Client) | `server.js` (Backend) | Severity | Root Cause |
|---|---|---|---|---|---|
| **`"beli 2 ayam geprek 25.000"`** | Nominal: `25.000` (or 2x25.000) | ❌ **Nominal: Rp225.000** | ✅ Nominal: Rp25.000 | 🔴 Critical | Client strips non-digits: `'2'` + `'25000'` = `'225000'`. |
| **`"makan bareng 4 teman 50.000"`** | Nominal: `50.000` | ❌ **Nominal: Rp450.000** | ✅ Nominal: Rp50.000 | 🔴 Critical | Digit concatenation bug corrupts balance by Rp400k. |
| **`"gaji 2 juta"`** | Nominal: `2.000.000`, Income | ❌ **Nominal: Rp2** | ✅ Nominal: Rp2.000.000 | 🔴 Critical | Client only tests regex for `jt`, not `juta`. Fallback treats `'2'` as Rp2. |
| **`"gaji supir 1.500.000"`** | Nominal: `1.500.000`, **Expense** | ❌ **Income (+Rp1.5M)** | ❌ **Income (+Rp1.5M)** | 🔴 Critical | Keyword `'gaji'` hardcoded to `type = 'income'`. Paying a driver increases balance! |
| **`"transfer 500rb ke gopay"`** | Nominal: `500.000`, **Transfer** | ❌ **Expense Makanan** | ❌ **Expense Makanan** | 🟠 High | Parser lacks transfer intent classification. |
| **`"beli novel 75rb"`** | Nominal: `75.000`, Edukasi | ❌ Category: Makanan | ❌ Category: Makanan | 🟡 Medium | Silent misclassification: non-matching keywords default to `Makanan & Minuman`. |
| **`"potong rambut 35.000"`** | Nominal: `35.000`, Lifestyle | ❌ Category: Makanan | ❌ Category: Makanan | 🟡 Medium | Missing personal care category keyword mappings. |
| **`"makan ber-4 habis 60rb"`** | Nominal: `60.000`, Expense | ❌ Nominal: Rp460.000 | ✅ Nominal: Rp60.000 | 🔴 Critical | Client joins `'4'` and `'60000'` into `460000`. |
| **`"beli 2 kopi @ 15rb"`** | Nominal: `30.000` or `15.000` with item note | ❌ Nominal: Rp215.000 | ⚠️ Nominal: Rp15.000 | 🟠 High | Quantity multiplier ignored; client concatenates digits. |
| **`"beli soto 15rb dan es teh 5rb"`** | Multi-item total `20.000` | ⚠️ Nominal: Rp15.000 | ⚠️ Nominal: Rp15.000 | 🟠 High | First regex match stops processing; subsequent items dropped. |

### 3.3 Silent Failures in Category & Transaction Type Classification

Both `server.js` (lines 597–682) and `telegram-engine.ts` (lines 125–157) execute naive keyword substring checks:
1. **Keyword Overlap**:
   - `"uang masuk dari kantor"` -> matches `"masuk"` -> Income.
   - `"tiket masuk ancol 50rb"` -> matches `"masuk"` -> **Incorrectly categorized as Income**!
   - `"beli obat nyamuk 15rb"` -> matches `"obat"` -> Categorized as `Kesehatan & Obat` (Health & Medicine) instead of Groceries/Household.
2. **Hardcoded Fallbacks**:
   - When no keyword matches, the system silently assigns `categoryName = 'Makanan & Minuman'` and emoji `🍜`.
   - The user receives no prompt asking to confirm or choose a category.

### 3.4 Idempotency & Transaction Deduplication Vulnerabilities

In `server.js` (lines 749–760):
```javascript
const updateId = payload.update_id || (Date.now() + Math.floor(Math.random() * 10000));
if (db.processedWebhooks.has(updateId)) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    ok: true,
    skipped_reason: 'idempotent_duplicate',
    reply_text: 'Transaksi dengan ID ini sudah diproses sebelumnya.'
  }));
  return;
}
db.processedWebhooks.add(updateId);
```

#### Vulnerabilities:
1. **Ephemeral In-Memory Set**:
   - `db.processedWebhooks` is stored in RAM. Any node restart, deployment, or crash resets the Set.
   - In a multi-replica / cluster environment, webhook retries hitting different instances bypass the check.
   - Database table `public.processed_webhooks` exists in `001_initial_schema.sql` (lines 172–178) but is **never queried or written to by `server.js`**!
2. **Random ID Fallback Bypass**:
   - If an incoming payload lacks `update_id` (common in simulator calls or custom webhook forwarders), `Date.now() + Math.random()` produces a unique number every time, completely bypassing deduplication.
3. **No Semantic Window Deduplication**:
   - If a user on Telegram experiences poor network and presses send twice, Telegram issues two distinct `update_id`s with identical text within 2 seconds.
   - The system executes both and debits the user's wallet twice. There is no sliding-window fingerprinting (e.g., `hash(user_id + amount + note)` within a 60-second window).
4. **Zero Deduplication in `telegram-engine.ts`**:
   - The client-side simulator has no idempotency mechanism whatsoever.

---

## 4. Current AI / LLM Integration & Mock Engines

### 4.1 Configured AI Providers in System State

`server.js` (lines 250–288) and `mock-data.ts` (lines 100–125) track three configured AI providers:
1. **Google Gemini 2.0 Flash** (`gemini-2.0-flash-exp`) — Primary provider (Priority 1, target latency ~310ms).
2. **OpenAI** (`gpt-4o-mini`, with Whisper for STT) — Failover priority 2 (target latency ~450ms).
3. **DeepSeek V3 / R1** (`deepseek-chat`) — Failover priority 3 (target latency ~580ms).

Admin capabilities exist in `server.js`:
- `POST /api/admin/ai-providers/mode`: Toggle between `'parallel'` (failover) and `'single'`.
- `POST /api/admin/ai-providers/toggle`: Activate/deactivate provider.
- `POST /api/admin/ai-providers`: Register custom provider with encrypted key.
- `GET /api/admin/audit-logs`: Audit logs of operations.

### 4.2 The `executeAiPipeline` Emulation Engine

In `server.js` (lines 526–587):
- For `actionType === 'transcribe_audio'`: Simulates speech recognition by echoing `options.transcriptText` or defaulting to `"Beli Pertamax motor 35rb"`.
- For `actionType === 'receipt_ocr'`: Returns hardcoded Indomaret Point receipt structure with 3 items totaling Rp84.500.
- For `actionType === 'parse_text'`: Delegates to regex-based `parseStructuredText()`.
- Calculates simulated latency (150–270ms) and token counts, then logs to `db.aiLogs`.

### 4.3 AI Financial Advisor Trigger

Currently implemented in:
- `server.js` (lines 930–935)
- `src/lib/telegram-engine.ts` (lines 282–287)

**Trigger Rules**:
1. User subscription plan must be `'pro'`.
2. Transaction must be `type === 'expense'`.
3. Condition 1: `nominal >= (budget.monthly_limit * 0.20)` (single transaction consumes $\ge 20\%$ of total monthly budget).
4. Condition 2: `(current_spent / monthly_limit) >= 0.80` (category has consumed $\ge 80\%$ of quota).

**Output**:
Appends an advisory block to the Telegram reply:
```
🤖 Financial Advisor
Hei Budi Pratama! Pengeluaran kategori Makanan kamu sudah mencapai 85% bulan ini.
💡 Saran: Tahan pengeluaran non-primer di kategori ini selama 7 hari ke depan untuk menjaga cashflow tetap sehat!
```

### 4.4 Missing In-App Tata AI Assistant

In `public/index.html` and `src/app/dashboard`:
- There is **no In-App Tata AI assistant panel, floating chat bubble, or interactive chat drawer**.
- The only modal present is the **Telegram Simulator Modal**, which tests the Telegram bot persona.
- Per Requirement **R4**, Tata AI must be accessible directly in the web dashboard for:
  - Interactive financial discussion in Indonesian.
  - Spending analysis & smart savings recommendations based on real transaction history.
  - Intelligent transaction recording simulation.

---

## 5. Unified Sharing Architecture: In-App Tata AI & Telegram Bot

To eliminate code duplication, eliminate parser discrepancies, and provide cohesive financial intelligence across both web and Telegram, the core logic should be unified into a **Shared Financial Intelligence Core**.

### 5.1 Architecture Diagram

```
                       ┌───────────────────────────────┐
                       │     User Interaction Layer    │
                       └───────────────┬───────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  Telegram Webhook / Bot API  │              │ In-App "Tata AI" Chat Drawer │
│    (/api/telegram/webhook)   │              │     (/api/ai/assistant)      │
└──────────────┬───────────────┘              └──────────────┬───────────────┘
               │                                             │
               └───────────────────────┬─────────────────────┘
                                       ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │          SHARED FINANCIAL INTELLIGENCE ENGINE (Tata AI)         │
    │  Location: src/lib/tata-ai-engine.ts / server shared service    │
    ├─────────────────────────────────────────────────────────────────┤
    │ 1. Indonesian Financial NL Parser (Multi-number, Slang, Quantities)
    │ 2. Financial Context Synthesizer (Wallets, 3-Scale Budgets, Txs)
    │ 3. Spending Analytics & Runway Calculator (Burn rate, Surplus)  │
    │ 4. Proactive & Reactive Advisory Generator (Indonesian Prompt)  │
    │ 5. Transaction Safety Simulator ("Bisa beli iPhone 15jt?")      │
    │ 6. Idempotency & Deduplication Guard (Hash + 60s sliding window)│
    └─────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                  Persistence & State Management                 │
    │        (Supabase PostgreSQL / LocalStorage State Store)         │
    └─────────────────────────────────────────────────────────────────┘
```

### 5.2 Core Capabilities of the Shared Intelligence Core

1. **Robust Indonesian Natural Language Parser (`parseIndonesianNLTransaction`)**:
   - Resolves quantities vs. unit prices (e.g. `"2 porsi sate 30rb"` $\rightarrow$ quantity: 2, amount: 30.000).
   - Handles informal number notations:
     - Multipliers: `jt`, `juta`, `million`, `rb`, `ribu`, `k`.
     - Thousand separators: Indonesian dot (`25.500`), English comma (`25,500`), and decimal commas (`12,5jt`).
     - Spelled-out Indonesian numbers: `setengah juta` $\rightarrow$ 500.000, `dua puluh ribu` $\rightarrow$ 20.000.
   - Detects negative keywords to prevent Income/Expense inversion:
     - `"gaji supir"`, `"bayar gaji"`, `"upah tukang"` $\rightarrow$ `type: 'expense'`.
     - `"terima gaji"`, `"gajian"`, `"transfer masuk"` $\rightarrow$ `type: 'income'`.
   - Distinguishes transfer intents:
     - `"transfer 100rb dari BCA ke GoPay"` $\rightarrow$ `type: 'transfer'`.
2. **Financial Context Synthesizer (`buildFinancialContext(userState)`)**:
   - Assembles:
     - Total net worth across all active wallets.
     - Multi-period budget consumption (daily, weekly, monthly).
     - Top expense categories in current billing cycle.
     - Cashflow surplus / deficit and runway.
3. **Conversational Advisory Engine (`generateTataAiResponse(query, context)`)**:
   - **Simulation Mode**: User asks *"Boleh beli iPad 8jt gak?"* $\rightarrow$ Tata AI inspects balance (Rp14M), monthly surplus (Rp3.8M), and remaining budget, replying with precise impact assessment.
   - **Analysis Mode**: User asks *"Kenapa pengeluaran saya bengkak?"* $\rightarrow$ Tata AI identifies that Lifestyle & Entertainment is at 90% and highlights specific large transactions.
   - **Savings Recommendation Mode**: User asks *"Gimana cara hemat 500rb bulan ini?"* $\rightarrow$ Tata AI suggests cutting non-essential dining and streaming subscriptions.
4. **Idempotency & Deduplication Guard (`verifyAndLockTransaction`)**:
   - Calculates a cryptographic idempotency key:
     $$\text{Key} = \text{SHA256}(\text{userId} + \text{amount} + \text{type} + \text{source} + \text{roundedMinute})$$
   - Persists key with a 60-second sliding expiration window.
   - Drops duplicate rapid retries cleanly while returning the original response.

---

## 6. Concrete Implementation Roadmap for Subsequent Agents

### Priority 1: Indonesian Parser Fixes (`src/lib/utils.ts` & `server.js`)
- Replace naive regex and `clean.replace(/[^0-9]/g, '')` in `src/lib/utils.ts` with a multi-pass tokenizing parser.
- Ensure `"beli 2 ayam geprek 25.000"` correctly isolates `25.000` as the price.
- Add support for `"juta"`, spelled-out numbers (`"setengah juta"`), and decimal commas (`"12,5jt"`).
- Add directional negative matching for salary expenses (`"gaji supir"` vs `"gaji bulanan"`).

### Priority 2: Idempotency & Webhook Hardening (`server.js`)
- Check both `update_id` AND a 60-second semantic fingerprint hash `(user_id, amount, note_snippet)`.
- Persist processed webhooks to `public.processed_webhooks` or persistent storage so restarts do not drop deduplication state.
- Ensure absence of `update_id` does not bypass deduplication.

### Priority 3: Shared Financial Intelligence Engine (`src/lib/tata-ai-engine.ts` & `server.js`)
- Create `src/lib/tata-ai-engine.ts` exporting:
  - `parseIndonesianNLTransaction(text)`
  - `evaluateFinancialHealth(state)`
  - `askTataAI(prompt, state)`
- Expose `POST /api/ai/assistant` in `server.js` using the same engine.

### Priority 4: In-App "Tata AI" Assistant Widget (UI)
- Create `src/components/TataAiAssistantModal.tsx` (or floating drawer) integrated into `src/app/dashboard/layout.tsx`.
- Include quick prompt chips:
  - 💡 *"Analisis pengeluaran bulan ini"*
  - 🎯 *"Rekomendasi penghematan cerdas"*
  - 🛒 *"Simulasi: Boleh beli laptop 10jt?"*
- Integrate seamlessly into `public/index.html` as well for the full-stack server view.

---

## 7. Verification Method

Subsequent implementers can verify parser accuracy and AI functionality with these test cases:

```javascript
// Test Matrix: Indonesian Currency Parser
assert(parseIndonesianCurrency("beli 2 ayam geprek 25.000") === 25000);
assert(parseIndonesianCurrency("gaji 12,5jt") === 12500000);
assert(parseIndonesianCurrency("gaji 2 juta") === 2000000);
assert(parseIndonesianCurrency("pulsa 50rb") === 50000);
assert(parseIndonesianCurrency("kopi 25k") === 25000);
assert(parseIndonesianCurrency("bayar kos 1.500.000,-") === 1500000);
assert(parseIndonesianCurrency("beli 3 mangkok bakso 45.000") === 45000);
```
