// ====================================================================
// TataDana Fintech SaaS — Round 2 Adversarial Stress Test Suite
// File: test_r2_adversarial_stress.js
//
// Empirical Verification Suite for Round 2 Multi-Period Budget Feature
// Covers:
// - Suite 1: Extreme Inputs & Adversarial Type Coercion (0, negative, trillions, decimals, NaN)
// - Suite 2: Temporal & WIB Date Boundary Stress (Midnight 00:00:00, 23:59:59, Leap Years, 7-day ms cutoff, Future Dates)
// - Suite 3: Alert Badges & Threshold Boundaries (79.9%, 80.0%, 99.9%, 100.0%, 250% overflow)
// - Suite 4: Concurrency & Rapid Period Switching (500x state flips, multi-category isolation, 2000-tx volume)
// - Suite 5: HTML Generation & Visual Robustness (XSS, missing fields, zero limit progress bar)
// - Suite 6: Live API & End-to-End System Synchronization
// ====================================================================

const http = require('http');
const path = require('path');
const assert = require('assert');

const budgetPeriodModule = require('./public/modules/budget-period.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(`     ↳ Diagnostic: ${err.message}`);
    failureDetails.push({ description, error: err.message, stack: err.stack });
  }
}

async function asyncTest(description, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(`     ↳ Diagnostic: ${err.message}`);
    failureDetails.push({ description, error: err.message, stack: err.stack });
  }
}

function get(reqPath, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3000${reqPath}`, { timeout: timeoutMs }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch (e) { parsed = { raw: body }; }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed, body });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 504, error: 'TIMEOUT', body: '', data: { ok: false, error: 'Request Timed Out' } });
    });
    req.on('error', err => {
      resolve({ status: 500, error: err.message, body: '', data: { ok: false, error: err.message } });
    });
  });
}

function post(reqPath, payload, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload || {});
    const req = http.request(`http://localhost:3000${reqPath}`, {
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch (e) { parsed = { raw: body }; }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed, body });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 504, error: 'TIMEOUT', body: '', data: { ok: false, error: 'Request Timed Out' } });
    });
    req.on('error', err => {
      resolve({ status: 500, error: err.message, body: '', data: { ok: false, error: err.message } });
    });
    req.write(data);
    req.end();
  });
}

function del(reqPath, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.request(`http://localhost:3000${reqPath}`, {
      method: 'DELETE',
      timeout: timeoutMs
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch (e) { parsed = { raw: body }; }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed, body });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 504, error: 'TIMEOUT', body: '', data: { ok: false } });
    });
    req.on('error', err => {
      resolve({ status: 500, error: err.message, body: '', data: { ok: false } });
    });
    req.end();
  });
}

async function runAdversarialStressSuite() {
  console.log('\n' + '═'.repeat(66));
  console.log('⚡ TATADANA FINTECH SAAS — ROUND 2 ADVERSARIAL STRESS SUITE');
  console.log('═'.repeat(66) + '\n');

  // ==================================================================
  // SUITE 1: EXTREME INPUTS & ADVERSARIAL TYPE COERCION
  // ==================================================================
  console.log('--- [SUITE 1] EXTREME INPUTS & ADVERSARIAL TYPE COERCION ---');

  test('S1.1: Zero monthly limit produces safe 0 limits without NaN/Infinity', () => {
    const budget = { category_id: 'cat-zero', category_name: 'Zero Cat', monthly_limit: 0 };
    const resDaily = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [], 'daily');
    const resWeekly = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [], 'weekly');
    const resMonthly = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [], 'monthly');

    assert.strictEqual(resDaily.limit, 0);
    assert.strictEqual(resWeekly.limit, 0);
    assert.strictEqual(resMonthly.limit, 0);
    assert.strictEqual(resDaily.percentage, 0);
    assert.strictEqual(resDaily.remaining, 0);
    assert.strictEqual(Number.isFinite(resDaily.percentage), true);
    assert.strictEqual(Number.isNaN(resDaily.percentage), false);
    assert.strictEqual(resDaily.status, 'normal');
  });

  test('S1.2: Zero monthly limit with non-zero spending prevents divide-by-zero / Infinity', () => {
    const budget = { category_id: 'cat-zero', category_name: 'Zero Cat', monthly_limit: 0 };
    const tx = { category_id: 'cat-zero', type: 'expense', amount: 75000, date: new Date().toISOString() };
    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [tx], 'daily');

    assert.strictEqual(res.spent, 75000);
    assert.strictEqual(res.limit, 0);
    assert.strictEqual(res.percentage, 0);
    assert.strictEqual(Number.isFinite(res.percentage), true);
    assert.strictEqual(Number.isNaN(res.percentage), false);
    assert.strictEqual(res.remaining, 0);
  });

  test('S1.3: Negative monthly limit is safely clamped to 0 without negative calculations', () => {
    const budget = { category_id: 'cat-neg', category_name: 'Negative Cat', monthly_limit: -500000 };
    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [], 'daily');

    assert.strictEqual(res.monthly_limit, 0);
    assert.strictEqual(res.limit, 0);
    assert.strictEqual(res.remaining, 0);
    assert.strictEqual(res.percentage, 0);
  });

  test('S1.4: Huge limit in Billions (10 Trillion IDR) calculates correctly without numeric overflow', () => {
    const tenTrillion = 10000000000000; // 10 Trillion
    const budget = { category_id: 'cat-huge', category_name: 'Mega Corp', monthly_limit: tenTrillion };

    const resDaily = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [], 'daily');
    const resWeekly = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [], 'weekly');
    const resMonthly = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [], 'monthly');

    const expectedDaily = Math.round(tenTrillion / 30); // 333333333333
    const expectedWeekly = Math.round(tenTrillion / 4); // 2500000000000

    assert.strictEqual(resDaily.limit, expectedDaily);
    assert.strictEqual(resWeekly.limit, expectedWeekly);
    assert.strictEqual(resMonthly.limit, tenTrillion);

    // Verify Indonesian dot format
    const formatted = budgetPeriodModule.formatNumber(tenTrillion);
    assert.strictEqual(formatted, '10.000.000.000.000');
    assert.strictEqual(budgetPeriodModule.formatRupiah(tenTrillion), 'Rp10.000.000.000.000');
  });

  test('S1.5: Quadrillion limit (1e15 within safe integer) formats without scientific notation', () => {
    const quadrillion = 1000000000000000;
    const formatted = budgetPeriodModule.formatNumber(quadrillion);
    assert.strictEqual(formatted.includes('e+'), false, 'Should not contain scientific notation');
    assert.strictEqual(formatted, '1.000.000.000.000.000');
  });

  test('S1.6: Decimal fractional limits round cleanly to integers', () => {
    const budget = { category_id: 'cat-dec', category_name: 'Decimal Cat', monthly_limit: 123456.78 };
    const resDaily = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [], 'daily');
    const resWeekly = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [], 'weekly');

    assert.strictEqual(Number.isInteger(resDaily.limit), true);
    assert.strictEqual(Number.isInteger(resWeekly.limit), true);
    assert.strictEqual(resDaily.limit, Math.round(123456.78 / 30));
  });

  test('S1.7: String limits are correctly coerced into numbers', () => {
    const budget = { category_id: 'cat-str', category_name: 'String Cat', monthly_limit: '1500000' };
    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [], 'monthly');
    assert.strictEqual(res.limit, 1500000);
  });

  test('S1.8: Malformed limits (NaN, null, undefined, "abc", {}, []) safely fallback to 0', () => {
    const badLimits = [NaN, null, undefined, 'not-a-number', {}, []];
    badLimits.forEach(badLimit => {
      const budget = { category_id: 'cat-bad', monthly_limit: badLimit };
      const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [], 'monthly');
      assert.strictEqual(res.limit, 0, `Expected 0 for limit ${badLimit}`);
      assert.strictEqual(res.percentage, 0);
    });
  });

  test('S1.9: Negative or zero transaction amounts are excluded from spending', () => {
    const budget = { category_id: 'cat-1', category_name: 'Makan', monthly_limit: 100000 };
    const today = new Date().toISOString();
    const badTxs = [
      { category_id: 'cat-1', type: 'expense', amount: -50000, date: today },
      { category_id: 'cat-1', type: 'expense', amount: 0, date: today },
      { category_id: 'cat-1', type: 'expense', amount: 'invalid', date: today }
    ];
    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, badTxs, 'daily');
    assert.strictEqual(res.spent, 0);
  });

  test('S1.10: Income transactions are strictly excluded from budget expense spending', () => {
    const budget = { category_id: 'cat-1', category_name: 'Makan', monthly_limit: 100000 };
    const today = new Date().toISOString();
    const txs = [
      { category_id: 'cat-1', type: 'income', amount: 500000, date: today },
      { category_id: 'cat-1', type: 'expense', amount: 25000, date: today }
    ];
    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, txs, 'daily');
    assert.strictEqual(res.spent, 25000);
  });

  test('S1.11: Currency formatters survive extreme negative and malformed inputs', () => {
    assert.strictEqual(budgetPeriodModule.formatRupiah(-50000), 'Rp0');
    assert.strictEqual(budgetPeriodModule.formatRupiah(null), 'Rp0');
    assert.strictEqual(budgetPeriodModule.formatRupiah(NaN), 'Rp0');
    assert.strictEqual(budgetPeriodModule.formatNumber(-100), '0');
    assert.strictEqual(budgetPeriodModule.formatNumber('invalid'), '0');
  });

  // ==================================================================
  // SUITE 2: TEMPORAL & WIB DATE BOUNDARY STRESS
  // ==================================================================
  console.log('\n--- [SUITE 2] TEMPORAL & WIB DATE BOUNDARY STRESS ---');

  test('S2.1: Transaction exactly at midnight WIB (00:00:00) belongs to the new WIB date', () => {
    // 2026-10-17 00:00:00 WIB is 2026-10-16 17:00:00 UTC
    const midnightWibUtc = '2026-10-16T17:00:00.000Z';
    const key = budgetPeriodModule.toWibDateKey(midnightWibUtc);
    assert.strictEqual(key, '2026-10-17', 'Midnight WIB should be 2026-10-17 in WIB');

    const budget = { category_id: 'cat-wib', monthly_limit: 300000 };
    const refDate = new Date('2026-10-17T05:00:00.000Z'); // 12:00 PM WIB on Oct 17
    const tx = { category_id: 'cat-wib', type: 'expense', amount: 15000, date: midnightWibUtc };

    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [tx], 'daily', refDate);
    assert.strictEqual(res.spent, 15000, 'Midnight WIB transaction must be included in today daily spending');
  });

  test('S2.2: Transaction 1ms before midnight WIB (23:59:59.999 prev day) is excluded from new day', () => {
    // 2026-10-16 23:59:59.999 WIB is 2026-10-16 16:59:59.999 UTC
    const beforeMidnightUtc = '2026-10-16T16:59:59.999Z';
    const key = budgetPeriodModule.toWibDateKey(beforeMidnightUtc);
    assert.strictEqual(key, '2026-10-16', '1ms before midnight should still be 2026-10-16 in WIB');

    const budget = { category_id: 'cat-wib', monthly_limit: 300000 };
    const refDate = new Date('2026-10-17T05:00:00.000Z'); // Oct 17 WIB
    const tx = { category_id: 'cat-wib', type: 'expense', amount: 15000, date: beforeMidnightUtc };

    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [tx], 'daily', refDate);
    assert.strictEqual(res.spent, 0, 'Previous day transaction must be excluded from today daily spending');
  });

  test('S2.3: Transaction at 23:59:59 WIB belongs to the current day', () => {
    // 2026-10-17 23:59:59 WIB is 2026-10-17 16:59:59.000Z
    const endOfDayUtc = '2026-10-17T16:59:59.000Z';
    const key = budgetPeriodModule.toWibDateKey(endOfDayUtc);
    assert.strictEqual(key, '2026-10-17');

    const budget = { category_id: 'cat-wib', monthly_limit: 300000 };
    const refDate = new Date('2026-10-17T02:00:00.000Z'); // 09:00 AM WIB
    const tx = { category_id: 'cat-wib', type: 'expense', amount: 20000, date: endOfDayUtc };

    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [tx], 'daily', refDate);
    assert.strictEqual(res.spent, 20000, 'End-of-day transaction should be included in daily spending');
  });

  test('S2.4: Leap year date Feb 29, 2024 is handled accurately', () => {
    // Feb 29, 2024 in WIB
    const leapDateUtc = '2024-02-29T03:00:00.000Z'; // 10:00 AM WIB Feb 29 2024
    const key = budgetPeriodModule.toWibDateKey(leapDateUtc);
    assert.strictEqual(key, '2024-02-29');

    const budget = { category_id: 'cat-leap', monthly_limit: 600000 };
    const refDate = new Date('2024-02-29T05:00:00.000Z');
    const txLeap = { category_id: 'cat-leap', type: 'expense', amount: 30000, date: leapDateUtc };
    const txFeb28 = { category_id: 'cat-leap', type: 'expense', amount: 40000, date: '2024-02-28T05:00:00.000Z' };

    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [txLeap, txFeb28], 'daily', refDate);
    assert.strictEqual(res.spent, 30000, 'Only Feb 29 transaction should match daily on Feb 29');
  });

  test('S2.5: Leap year date Feb 29, 2028 is handled accurately', () => {
    const leap2028 = '2028-02-29T10:00:00.000Z';
    const key = budgetPeriodModule.toWibDateKey(leap2028);
    assert.strictEqual(key, '2028-02-29');
  });

  test('S2.6: Non-leap year transition Feb 28 to Mar 1 (2025)', () => {
    const feb28 = budgetPeriodModule.toWibDateKey('2025-02-28T05:00:00.000Z');
    const mar1 = budgetPeriodModule.toWibDateKey('2025-03-01T05:00:00.000Z');
    assert.strictEqual(feb28, '2025-02-28');
    assert.strictEqual(mar1, '2025-03-01');
  });

  test('S2.7: Future transactions (post-dated) are excluded from daily and weekly calculations', () => {
    const budget = { category_id: 'cat-future', monthly_limit: 300000 };
    const refDate = new Date('2026-10-17T10:00:00.000Z');
    // Future transaction tomorrow
    const futureDailyTx = { category_id: 'cat-future', type: 'expense', amount: 50000, date: '2026-10-18T10:00:00.000Z' };
    // Future transaction 2 hours in the future
    const futureWeeklyTx = { category_id: 'cat-future', type: 'expense', amount: 70000, date: '2026-10-17T12:00:00.000Z' };

    const resDaily = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [futureDailyTx], 'daily', refDate);
    assert.strictEqual(resDaily.spent, 0, 'Tomorrow transaction must not be counted in today daily');

    const resWeekly = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [futureWeeklyTx], 'weekly', refDate);
    assert.strictEqual(resWeekly.spent, 0, 'Future transaction must not be counted in weekly spending');
  });

  test('S2.8: Weekly boundary down to the millisecond (exactly 7 days vs 7 days + 1ms)', () => {
    const budget = { category_id: 'cat-week', monthly_limit: 400000 };
    const refDate = new Date('2026-10-17T12:00:00.000Z');
    const refTime = refDate.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Tx 1: Exactly 7 days ago down to the millisecond
    const exact7DaysAgo = new Date(refTime - sevenDaysMs).toISOString();
    const txExact = { category_id: 'cat-week', type: 'expense', amount: 50000, date: exact7DaysAgo };

    // Tx 2: 7 days + 1 millisecond ago
    const over7DaysAgo = new Date(refTime - sevenDaysMs - 1).toISOString();
    const txOver = { category_id: 'cat-week', type: 'expense', amount: 25000, date: over7DaysAgo };

    const resExact = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [txExact], 'weekly', refDate);
    assert.strictEqual(resExact.spent, 50000, 'Transaction at exactly 7 days ago must be included in weekly');

    const resOver = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [txOver], 'weekly', refDate);
    assert.strictEqual(resOver.spent, 0, 'Transaction at 7 days + 1ms ago must be excluded from weekly');
  });

  test('S2.9: Invalid date strings in transactions are skipped without crashing', () => {
    const budget = { category_id: 'cat-inv', monthly_limit: 300000 };
    const tx = { category_id: 'cat-inv', type: 'expense', amount: 50000, date: 'invalid-date-string' };
    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [tx], 'daily');
    assert.strictEqual(res.spent, 0);
  });

  // ==================================================================
  // SUITE 3: ALERT BADGES & UTILIZATION BOUNDARIES
  // ==================================================================
  console.log('\n--- [SUITE 3] ALERT BADGES & UTILIZATION BOUNDARIES ---');

  test('S3.1: Exactly 79.9% utilization does NOT trigger warning badge', () => {
    const budget = { category_id: 'cat-alert', monthly_limit: 3000000 }; // Daily = 100.000
    // Spent 79.900 on 100.000 limit -> 79.9%
    const tx = { category_id: 'cat-alert', type: 'expense', amount: 79900, date: new Date().toISOString() };
    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [tx], 'daily');

    assert.strictEqual(res.limit, 100000);
    assert.strictEqual(res.spent, 79900);
    assert.strictEqual(res.rawPercentage, 79.9);
    assert.strictEqual(res.status, 'normal', '79.9% should be normal, not warning');
    assert.strictEqual(res.hasWarning, false);
    assert.strictEqual(res.hasDanger, false);
  });

  test('S3.2: Exactly 80.0% utilization DOES trigger warning badge', () => {
    const budget = { category_id: 'cat-alert', monthly_limit: 3000000 }; // Daily = 100.000
    // Spent 80.000 on 100.000 limit -> exactly 80.0%
    const tx = { category_id: 'cat-alert', type: 'expense', amount: 80000, date: new Date().toISOString() };
    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [tx], 'daily');

    assert.strictEqual(res.rawPercentage, 80);
    assert.strictEqual(res.status, 'warning');
    assert.strictEqual(res.hasWarning, true);
    assert.strictEqual(res.hasDanger, false);

    const cardHtml = budgetPeriodModule.renderCardHtml(budget, res);
    assert.strictEqual(cardHtml.includes('bg-amber-500'), true);
    assert.strictEqual(cardHtml.includes('Alert 80% tercapai!'), true);
  });

  test('S3.3: Exactly 99.9% utilization remains in warning state (NOT danger)', () => {
    const budget = { category_id: 'cat-alert', monthly_limit: 3000000 }; // Daily = 100.000
    // Spent 99.900 on 100.000 limit -> 99.9%
    const tx = { category_id: 'cat-alert', type: 'expense', amount: 99900, date: new Date().toISOString() };
    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [tx], 'daily');

    assert.strictEqual(res.rawPercentage, 99.9);
    assert.strictEqual(res.status, 'warning');
    assert.strictEqual(res.hasWarning, true);
    assert.strictEqual(res.hasDanger, false);
  });

  test('S3.4: Exactly 100.0% utilization DOES trigger danger badge', () => {
    const budget = { category_id: 'cat-alert', monthly_limit: 3000000 }; // Daily = 100.000
    // Spent 100.000 on 100.000 limit -> exactly 100.0%
    const tx = { category_id: 'cat-alert', type: 'expense', amount: 100000, date: new Date().toISOString() };
    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [tx], 'daily');

    assert.strictEqual(res.rawPercentage, 100);
    assert.strictEqual(res.status, 'danger');
    assert.strictEqual(res.hasDanger, true);
    assert.strictEqual(res.isOverBudget, true);
    assert.strictEqual(res.remaining, 0);

    const cardHtml = budgetPeriodModule.renderCardHtml(budget, res);
    assert.strictEqual(cardHtml.includes('bg-rose-500'), true);
    assert.strictEqual(cardHtml.includes('Over-budget!'), true);
    assert.strictEqual(cardHtml.includes('Bahaya'), true);
  });

  test('S3.5: Extreme over-budget at 250% clamps progress bar width to 100% while displaying true 250%', () => {
    const budget = { category_id: 'cat-alert', monthly_limit: 3000000 }; // Daily = 100.000
    // Spent 250.000 on 100.000 limit -> 250%
    const tx = { category_id: 'cat-alert', type: 'expense', amount: 250000, date: new Date().toISOString() };
    const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [tx], 'daily');

    assert.strictEqual(res.percentage, 250);
    assert.strictEqual(res.clampedPct, 100, 'Visual progress bar width must clamp to 100%');
    assert.strictEqual(res.progressBarWidth, 100);
    assert.strictEqual(res.remaining, 0, 'Remaining must clamp to 0 and not display negative rupiah');
    assert.strictEqual(res.status, 'danger');

    const cardHtml = budgetPeriodModule.renderCardHtml(budget, res);
    assert.strictEqual(cardHtml.includes('style="width: 100%"'), true, 'CSS width must be 100%');
    assert.strictEqual(cardHtml.includes('(250%)'), true, 'Text quota must display true 250%');
    assert.strictEqual(cardHtml.includes('Rp250.000 / Rp100.000 (250%)'), true);
  });

  test('S3.6: Monotonic progression test through all utilization tiers', () => {
    const budget = { category_id: 'cat-seq', monthly_limit: 3000000 }; // Daily = 100.000
    const today = new Date().toISOString();

    const steps = [
      { spent: 0, expectedStatus: 'normal', isWarn: false, isDang: false },
      { spent: 50000, expectedStatus: 'normal', isWarn: false, isDang: false },
      { spent: 79900, expectedStatus: 'normal', isWarn: false, isDang: false },
      { spent: 80000, expectedStatus: 'warning', isWarn: true, isDang: false },
      { spent: 99900, expectedStatus: 'warning', isWarn: true, isDang: false },
      { spent: 100000, expectedStatus: 'danger', isWarn: false, isDang: true },
      { spent: 500000, expectedStatus: 'danger', isWarn: false, isDang: true }
    ];

    steps.forEach((s, idx) => {
      const tx = { category_id: 'cat-seq', type: 'expense', amount: s.spent, date: today };
      const res = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, [tx], 'daily');
      assert.strictEqual(res.status, s.expectedStatus, `Step ${idx} spent=${s.spent} expected status ${s.expectedStatus}`);
      assert.strictEqual(res.hasWarning, s.isWarn, `Step ${idx} warning check`);
      assert.strictEqual(res.hasDanger, s.isDang, `Step ${idx} danger check`);
    });
  });

  // ==================================================================
  // SUITE 4: CONCURRENCY & RAPID SWITCHING STRESS
  // ==================================================================
  console.log('\n--- [SUITE 4] CONCURRENCY & RAPID SWITCHING STRESS ---');

  test('S4.1: Rapid switching (500x state flips) maintains integrity without state corruption', () => {
    const periods = ['daily', 'weekly', 'monthly'];
    for (let i = 0; i < 500; i++) {
      const targetPeriod = periods[i % 3];
      budgetPeriodModule.setActivePeriod(targetPeriod);
      assert.strictEqual(budgetPeriodModule.getActivePeriod(), targetPeriod);
    }
    // Return to default
    budgetPeriodModule.setActivePeriod('monthly');
    assert.strictEqual(budgetPeriodModule.getActivePeriod(), 'monthly');
  });

  test('S4.2: Multi-category isolation under differing period perspectives', () => {
    const catA = { category_id: 'cat-a', category_name: 'Makan', monthly_limit: 1500000 }; // Daily: 50.000, Weekly: 375.000
    const catB = { category_id: 'cat-b', category_name: 'Transport', monthly_limit: 800000 }; // Daily: 26.667, Weekly: 200.000
    const catC = { category_id: 'cat-c', category_name: 'Tagihan', monthly_limit: 1000000 }; // Daily: 33.333, Weekly: 250.000

    const today = new Date().toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

    const txs = [
      // Cat A: 60.000 today -> Over budget in Daily (120%), but Safe in Weekly (60.000 / 375.000 = 16%)
      { category_id: 'cat-a', type: 'expense', amount: 60000, date: today },
      // Cat B: 22.000 today -> Warning in Daily (22.000 / 26.667 = 82.5%)
      { category_id: 'cat-b', type: 'expense', amount: 22000, date: today },
      // Cat C: 0 today, but 260.000 3 days ago -> Safe in Daily (0%), Danger in Weekly (260.000 / 250.000 = 104%)
      { category_id: 'cat-c', type: 'expense', amount: 260000, date: threeDaysAgo }
    ];

    // In Daily view:
    const statsADaily = budgetPeriodModule.calculateCategoryBudgetPeriod(catA, txs, 'daily');
    const statsBDaily = budgetPeriodModule.calculateCategoryBudgetPeriod(catB, txs, 'daily');
    const statsCDaily = budgetPeriodModule.calculateCategoryBudgetPeriod(catC, txs, 'daily');

    assert.strictEqual(statsADaily.status, 'danger', 'Cat A must be danger in daily');
    assert.strictEqual(statsBDaily.status, 'warning', 'Cat B must be warning in daily');
    assert.strictEqual(statsCDaily.status, 'normal', 'Cat C must be normal in daily (0 today)');

    // In Weekly view:
    const statsAWeekly = budgetPeriodModule.calculateCategoryBudgetPeriod(catA, txs, 'weekly');
    const statsBWeekly = budgetPeriodModule.calculateCategoryBudgetPeriod(catB, txs, 'weekly');
    const statsCWeekly = budgetPeriodModule.calculateCategoryBudgetPeriod(catC, txs, 'weekly');

    assert.strictEqual(statsAWeekly.status, 'normal', 'Cat A must be normal in weekly');
    assert.strictEqual(statsBWeekly.status, 'normal', 'Cat B must be normal in weekly');
    assert.strictEqual(statsCWeekly.status, 'danger', 'Cat C must be danger in weekly');
  });

  test('S4.3: High-volume transaction stress (2,000 transactions) executes in < 250ms', () => {
    const budget = { category_id: 'cat-bulk', category_name: 'Bulk Cat', monthly_limit: 3000000 };
    const txs = [];
    const now = Date.now();

    // Generate 2000 transactions spread across 60 days
    for (let i = 0; i < 2000; i++) {
      const daysOffset = (i % 60);
      const isTargetCat = (i % 2 === 0);
      txs.push({
        id: `tx-bulk-${i}`,
        category_id: isTargetCat ? 'cat-bulk' : 'cat-other',
        category_name: isTargetCat ? 'Bulk Cat' : 'Other Cat',
        type: (i % 5 === 0) ? 'income' : 'expense',
        amount: 1000 + (i % 100) * 100,
        date: new Date(now - daysOffset * 86400000).toISOString()
      });
    }

    const start = Date.now();
    const resDaily = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, txs, 'daily');
    const resWeekly = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, txs, 'weekly');
    const resMonthly = budgetPeriodModule.calculateCategoryBudgetPeriod(budget, txs, 'monthly');
    const duration = Date.now() - start;

    assert.strictEqual(duration < 250, true, `Calculations for 2,000 transactions took ${duration}ms, expected < 250ms`);
    assert.strictEqual(resDaily.spent >= 0, true);
    assert.strictEqual(resWeekly.spent >= resDaily.spent, true, 'Weekly spending should be >= daily spending');
    assert.strictEqual(resMonthly.spent >= resDaily.spent, true, 'Monthly spending should be >= daily spending');
  });

  test('S4.4: Concurrent period switching across 10 categories simultaneously', () => {
    const categories = Array.from({ length: 10 }, (_, i) => ({
      category_id: `cat-multi-${i}`,
      category_name: `Category ${i}`,
      monthly_limit: (i + 1) * 200000
    }));

    const txs = categories.flatMap(cat => [
      { category_id: cat.category_id, type: 'expense', amount: 15000, date: new Date().toISOString() }
    ]);

    const periods = ['daily', 'weekly', 'monthly'];
    for (let cycle = 0; cycle < 50; cycle++) {
      const p = periods[cycle % 3];
      budgetPeriodModule.setActivePeriod(p);

      categories.forEach(cat => {
        const stats = budgetPeriodModule.calculateCategoryBudgetPeriod(cat, txs, p);
        assert.strictEqual(typeof stats.limit, 'number');
        assert.strictEqual(typeof stats.spent, 'number');
        assert.strictEqual(Number.isFinite(stats.percentage), true);
      });
    }
  });

  // ==================================================================
  // SUITE 5: HTML GENERATION & VISUAL ROBUSTNESS
  // ==================================================================
  console.log('\n--- [SUITE 5] HTML GENERATION & VISUAL ROBUSTNESS ---');

  test('S5.1: XSS attempt in category_name does not crash template rendering', () => {
    const maliciousBudget = {
      category_id: 'cat-xss',
      category_name: '<script>alert("HACKED")</script>',
      category_emoji: '💀',
      monthly_limit: 1500000
    };
    const stats = budgetPeriodModule.calculateCategoryBudgetPeriod(maliciousBudget, [], 'daily');
    const html = budgetPeriodModule.renderCardHtml(maliciousBudget, stats);

    assert.strictEqual(typeof html, 'string');
    assert.strictEqual(html.includes('category-budget-card'), true);
  });

  test('S5.2: Missing properties in budget object render cleanly with fallbacks', () => {
    const minimalBudget = {}; // Empty object
    const stats = budgetPeriodModule.calculateCategoryBudgetPeriod(minimalBudget, [], 'monthly');
    const html = budgetPeriodModule.renderCardHtml(minimalBudget, stats);

    assert.strictEqual(typeof html, 'string');
    assert.strictEqual(html.includes('🎯'), true, 'Default emoji should be 🎯');
    assert.strictEqual(html.includes('Rp0 / Rp0 (0%)'), true);
  });

  test('S5.3: Container renderer handles empty or null budgets gracefully', () => {
    // In Node.js environment, renderContainer safely exits without document
    assert.doesNotThrow(() => {
      budgetPeriodModule.renderContainer('non-existent-container', []);
      budgetPeriodModule.renderContainer('non-existent-container', null);
      budgetPeriodModule.renderAllBudgetSections();
      budgetPeriodModule.syncTabsUI();
    });
  });

  // ==================================================================
  // SUITE 6: LIVE API & END-TO-END SYSTEM SYNCHRONIZATION
  // ==================================================================
  console.log('\n--- [SUITE 6] LIVE API & END-TO-END SYSTEM SYNCHRONIZATION ---');

  // Auto-start server if not already running
  try {
    const ping = await get('/api/state');
    if (ping.status !== 200) throw new Error('Not running');
  } catch (e) {
    require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  await asyncTest('S6.1: Backend state returns valid budget items matching dynamic period calculations', async () => {
    const res = await get('/api/state');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(Array.isArray(res.data.budgets), true);
    assert.strictEqual(res.data.budgets.length > 0, true);

    const firstBudget = res.data.budgets[0];
    const stats = budgetPeriodModule.calculateCategoryBudgetPeriod(firstBudget, res.data.transactions || [], 'monthly');
    assert.strictEqual(typeof stats.limit, 'number');
    assert.strictEqual(typeof stats.spent, 'number');
    assert.strictEqual(typeof stats.percentage, 'number');
  });

  await asyncTest('S6.2: Real-time transaction insertion reflects instantly in daily category spending', async () => {
    const uniqueDesc = `Adversarial_Stress_${Date.now()}`;
    const testAmount = 45000;

    // Fetch initial state
    const beforeState = await get('/api/state');
    const targetBudget = beforeState.data.budgets[0];
    assert.ok(targetBudget, 'Target budget must exist');

    const beforeStats = budgetPeriodModule.calculateCategoryBudgetPeriod(targetBudget, beforeState.data.transactions, 'daily');

    // Create new transaction today
    const postRes = await post('/api/transactions', {
      wallet_id: beforeState.data.wallets[0].id,
      category_id: targetBudget.category_id,
      type: 'expense',
      amount: testAmount,
      description: uniqueDesc,
      date: new Date().toISOString()
    });
    assert.strictEqual(postRes.status, 200);
    assert.strictEqual(postRes.data.ok, true);

    const createdTxId = postRes.data.transaction && postRes.data.transaction.id;

    // Fetch updated state
    const afterState = await get('/api/state');
    const afterStats = budgetPeriodModule.calculateCategoryBudgetPeriod(targetBudget, afterState.data.transactions, 'daily');

    assert.strictEqual(afterStats.spent, beforeStats.spent + testAmount, 'Daily spent must increase by exact transaction amount');

    // Clean up
    if (createdTxId) {
      await del(`/api/transactions/${createdTxId}`);
    }
  });

  // ==================================================================
  // SUMMARY RESULTS
  // ==================================================================
  console.log('\n' + '═'.repeat(66));
  console.log('📊 TATADANA ROUND 2 ADVERSARIAL STRESS RESULTS:');
  console.log(`   Total Tests : ${totalTests}`);
  console.log(`   Passed      : ${passedTests} ✅`);
  console.log(`   Failed      : ${failedTests} ❌`);
  const successRate = Math.round((passedTests / totalTests) * 100);
  console.log(`   Success Rate: ${successRate}%`);
  console.log('═'.repeat(66) + '\n');

  if (failedTests > 0) {
    console.error('❌ Failures encountered:');
    failureDetails.forEach(f => {
      console.error(`- ${f.description}: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 ALL EMPIRICAL ADVERSARIAL STRESS TESTS PASSED WITH 0 FAILURES!\n');
    process.exit(0);
  }
}

runAdversarialStressSuite().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
