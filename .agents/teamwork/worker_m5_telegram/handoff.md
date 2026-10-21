# Handoff Report: Milestone 5 (R5) — Deteksi Masalah & Perbaikan Logika Bot Telegram

## 1. Observation

Direct code observations from the initial codebase:
1. **Digit Concatenation & Parser Failure in `src/lib/utils.ts` (lines 75-100)**:
   ```typescript
   export function parseIndonesianCurrency(text: string): number | null {
     const clean = text.toLowerCase().replace(/\s+/g, '');
     ...
     const digitsMatch = clean.replace(/[^0-9]/g, '');
     if (digitsMatch.length > 0) {
       const val = parseInt(digitsMatch, 10);
       return isNaN(val) ? null : val;
     }
     return null;
   }
   ```
   For multi-word strings containing quantities like `"beli 2 ayam geprek 25.000"`, `clean.replace(/[^0-9]/g, '')` stripped all alphabetical characters and concatenated `'2'` and `'25000'` into `'225000'`. Furthermore, strings containing the word `'juta'` (e.g. `'12,5 juta'`) failed to match because regex only matched `'jt'`. Comma decimals (`12,5jt`) were also missing in plain digit checks.
2. **Income Inversion Bug in `server.js` (lines 597-606) & `src/lib/telegram-engine.ts` (lines 125-136)**:
   ```javascript
   if (
     lower.includes('gaji') ||
     lower.includes('gajian') ||
     ...
   ) {
     type = 'income';
     categoryName = 'Pemasukan';
   }
   ```
   Any message mentioning `'gaji'` was unconditionally marked as `type = 'income'`, misclassifying expenses like `'gaji supir 1.5jt'`, `'bayar gaji pembantu 2jt'`, or `'gaji karyawan 3.5jt'` as income mutations.
3. **Silent Misclassification to Makanan & Minuman in `server.js` (lines 607-609)**:
   ```javascript
   let type = 'expense';
   let categoryName = 'Makanan & Minuman';
   let categoryEmoji = '🍜';
   ```
   `parseStructuredText` lacked an explicit branch for food keywords and defaulted all unmatched expenses (e.g. `'potong rambut 35rb'`, `'beli semen 50rb'`, `'donasi 100rb'`) to `'Makanan & Minuman'` (🍜).
4. **Webhook Deduplication Loopholes in `server.js` (lines 747-759)**:
   ```javascript
   const updateId = payload.update_id || (Date.now() + Math.floor(Math.random() * 10000));
   if (db.processedWebhooks.has(updateId)) { ... }
   db.processedWebhooks.add(updateId);
   ```
   When `payload.update_id` was omitted or null, a random number was generated for every call, allowing repeated duplicate webhook payloads to completely bypass idempotency. Furthermore, retry payloads sent with different or non-standard `update_id`s within a short window were recorded as separate duplicate transactions.

---

## 2. Logic Chain

From these observations, the following step-by-step logic was derived and implemented:
1. **Created Shared NLP Engine (`src/lib/telegram-nlp.js`)**:
   - `parseIndonesianCurrency`: Extracts nominals using prioritized regex patterns:
     - Group 1: Juta (`jt`, `juta`, `million`) with dot/comma decimals (`12,5jt`, `12.5 juta` -> `12500000`).
     - Group 2: Ribu (`rb`, `ribu`, `k`) with dot/comma decimals (`50rb`, `50 ribu`, `50k` -> `50000`).
     - Group 3: Dot/comma thousand separators (`25.000`, `25.500`, `1.500.000` -> `25000`, `25500`, `1500000`).
     - Group 4: Currency prefix (`Rp 25000`, `Rp 500`).
     - Group 5: Suffix (`500 perak`, `25000 rupiah`).
     - Group 6: 4+ digit plain numbers (`\b\d{4,}\b`), safely picking the transaction nominal while ignoring 1-2 digit item quantities like `2 ayam`.
   - Updated `src/lib/utils.ts` and `server.js` with identical robust logic, completely eliminating the concatenation flaw.
2. **Income Inversion Prevention (`isSalaryExpense`)**:
   - Implemented `isSalaryExpense(text)` detecting paying verbs (`bayar gaji`, `membayar upah`, `kasih honor`) and employee/staff recipients (`gaji supir`, `gaji pembantu`, `gaji art`, `gaji karyawan`, `gaji staf`, `gaji babysitter`, `gaji satpam`, etc.).
   - When detected, sets `type = 'expense'`, routes category to `Tagihan & Utilitas` (or `Lain-lain`), preserving the transaction note and preventing false income inflation.
3. **Elimination of Silent Misclassification**:
   - Added explicit keyword branches for `Makanan & Minuman` (including `ayam`, `resto`, `warung`, `geprek`, `soto`, `rendang`, etc.).
   - Added fallback category `cat_lain` (`'Lain-lain'` with emoji `'💸'`) to both `INITIAL_CATEGORIES` and `INITIAL_BUDGETS`.
   - Unrecognized expenses now fall back to `'Lain-lain'` with zero silent contamination of `'Makanan & Minuman'`.
4. **Hardened Webhook Deduplication & Semantic Fingerprinting**:
   - Generated SHA-256 semantic fingerprint: `${senderId}:${normalizedText}:${isVoice}:${isPhoto}:${mediaId}`.
   - Deterministic fallback `updateId = 'fp_' + semanticHash.slice(0, 16)` prevents idempotency bypass when `update_id` is missing.
   - Added `db.webhookFingerprints` with a rolling 60-second durable deduplication window to catch retries with differing envelopes.
   - Commands (`/saldo`, `/budget`, `/sheet`) continue to respond without mutating state while duplicate transaction messages are safely dropped with `skipped_reason: 'idempotent_duplicate'`.

---

## 3. Caveats

- Natural language parser relies on standard Indonesian linguistic cues; highly scrambled or ungrammatical slang without standard units/currencies will return `null` and trigger the polite guidance prompt rather than guess incorrectly.
- In-memory deduplication window is set to 60,000 ms (60 seconds) in accordance with PROJECT.md specifications. In multi-instance distributed deployments, a shared Redis or Postgres table (`processed_webhooks`) should back this store.

---

## 4. Conclusion

Milestone 5 (R5) requirements are fully met:
- Complex nominal parser extracts correct values across all specified cases (`makan 25.500` -> 25500, `gaji 12,5jt` -> 12500000, `beli pulsa 50rb` -> 50000, `beli 2 ayam geprek 25.000` -> 25000, etc.).
- Income inversion bug is resolved: `gaji supir 1.5jt` and `bayar gaji pembantu 2jt` are recorded as expenses.
- Silent misclassification is prevented: unrecognized expenses map to `Lain-lain` (💸) rather than `Makanan & Minuman` (🍜).
- Webhook idempotency is hardened: missing `update_id`s generate deterministic fingerprints, and identical payloads within 60 seconds are deduplicated without transaction inflation.
- Full test suite passes: **146 / 146 tests** in `node test_suite.js` and **86 / 86 tests** in `node test_navigation.js`.

---

## 5. Verification Method

To independently verify this implementation:

1. **Run Full Production Test Suite**:
   ```powershell
   node test_suite.js
   ```
   **Expected Result**:
   - 146 / 146 tests pass with exit code 0.
   - Specifically confirms:
     - Tests 91-107: Complex currency parser & quantity isolation.
     - Tests 108-120: Income inversion detection & classification.
     - Tests 121-125: Anti-silent misclassification fallbacks.
     - Tests 126-136: Webhook end-to-end processing & semantic idempotency.

2. **Run Routing & Navigation Test Suite**:
   ```powershell
   node test_navigation.js
   ```
   **Expected Result**:
   - 86 / 86 tests pass with exit code 0, confirming zero regressions.

3. **Inspect Modified Files**:
   - `src/lib/telegram-nlp.js`: Modular NLP and currency parsing engine.
   - `src/lib/utils.ts`: `parseIndonesianCurrency` and `isSalaryExpense`.
   - `src/lib/telegram-engine.ts`: `processTelegramMessage` with inversion protection and `Lain-lain` fallback.
   - `server.js`: `/api/telegram/webhook` with semantic deduplication and `parseStructuredText`.
