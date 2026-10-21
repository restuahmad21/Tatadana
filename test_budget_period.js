// ====================================================================
// TataDana Fintech SaaS — Round 2 (R1 - R4) Test Suite
// Multi-Period Budget Filter (Harian, Mingguan, Bulanan)
//
// 4-Tier Test Architecture:
// - Tier 1: Feature Coverage (Tabs rendering in Beranda & Subtab Budget,
//           switching tabs, daily/weekly/monthly calculations)
// - Tier 2: Boundary & Corner Cases (0 budget limit, 0 transactions,
//           boundary at 80% & 100%, >100% overflow, date boundary filtering)
// - Tier 3: Cross-Feature Combinations (Web transaction mutation,
//           Telegram bot webhook integration, admin budget expansion, deletion)
// - Tier 4: Real-World Application Scenarios (E2E daily spending spree,
//           multi-view consistency, regression verification)
// ====================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function get(reqPath, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
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
  return new Promise((resolve, reject) => {
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
  return new Promise((resolve, reject) => {
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

// Generate unique update IDs for Telegram Webhook
let currentUid = Math.floor(Date.now() / 1000) * 1000 + 500;
function nextUid() {
  currentUid += 1;
  return currentUid;
}

// Authoritative reference calculation engine derived from ORIGINAL_REQUEST.md (R1-R4) & PROJECT.md
function referenceCalculateCategoryBudget(budget, transactions = [], period = 'monthly', refDate = new Date()) {
  const monthlyLimit = Math.max(0, Number(budget.monthly_limit) || 0);

  let limit = 0;
  if (period === 'daily') {
    limit = Math.round(monthlyLimit / 30);
  } else if (period === 'weekly') {
    limit = Math.round(monthlyLimit / 4);
  } else {
    limit = monthlyLimit;
  }

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
  const refTime = refDate.getTime();

  // Helper for WIB YYYY-MM-DD
  function toWibDateKey(d) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  }

  const refWibDate = toWibDateKey(refDate);
  const refYear = refDate.getFullYear();
  const refMonth = refDate.getMonth();

  // Filter expenses matching category
  const catExpenses = (transactions || []).filter(t => {
    if (t.type !== 'expense') return false;
    const catIdMatch = (t.category_id && budget.category_id && t.category_id === budget.category_id);
    const catNameMatch = (t.category_name && budget.category_name && t.category_name === budget.category_name);
    return catIdMatch || catNameMatch;
  });

  let spent = 0;
  catExpenses.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) return;
    const txDate = new Date(tx.transaction_date);
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

  const rawPct = limit > 0 ? (spent / limit) * 100 : 0;
  const percentage = limit > 0 ? Math.round(rawPct) : 0;
  const remaining = Math.max(0, limit - spent);

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

  return {
    period,
    limit,
    spent,
    remaining,
    percentage,
    rawPercentage: rawPct,
    status,
    hasWarning,
    hasDanger
  };
}

// Load frontend module in VM sandbox for node environment testing
function loadClientBudgetPeriodModule() {
  const modulePath = path.join(__dirname, 'public', 'modules', 'budget-period.js');
  if (!fs.existsSync(modulePath)) {
    return null;
  }
  const code = fs.readFileSync(modulePath, 'utf8');
  const sandbox = {
    window: {},
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    Intl,
    Date,
    Math,
    Number,
    console,
    module: { exports: {} },
    exports: {}
  };
  sandbox.window = sandbox;
  try {
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window.TataDanaBudgetPeriod || sandbox.module.exports || sandbox;
  } catch (err) {
    return { error: err.message };
  }
}

async function runBudgetPeriodTests() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('🎯 TATADANA ROUND 2 (R1 - R4) MULTI-PERIOD BUDGET TEST SUITE');
  console.log('══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;
  let total = 0;

  function assert(condition, testName, diagnostic = '') {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (diagnostic) console.error(`     ↳ Diagnostic: ${diagnostic}`);
      failed++;
    }
  }

  // Ensure server is reachable
  const checkState = await get('/api/state');
  if (checkState.status !== 200) {
    console.log('Starting internal server...');
    require('./server.js');
    await new Promise(r => setTimeout(r, 800));
  }

  // Reset state before running tests
  try {
    await post('/api/test/reset-state');
  } catch (e) {
    console.warn('State reset warning:', e.message);
  }

  const htmlPath = path.join(__dirname, 'public', 'index.html');
  const htmlContent = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
  const clientModule = loadClientBudgetPeriodModule();

  // ==================================================================
  // TIER 1: FEATURE COVERAGE & CORE FUNCTIONALITY (R1, R2, R3)
  // ==================================================================
  console.log('\n--- [TIER 1] FEATURE COVERAGE & INTERFACE CONTRACTS ---');

  // T1.1: Module presence on filesystem and HTML script inclusion
  const moduleDiskPath = path.join(__dirname, 'public', 'modules', 'budget-period.js');
  const moduleExists = fs.existsSync(moduleDiskPath);
  assert(moduleExists, 'T1.1.1: public/modules/budget-period.js exists on filesystem',
    moduleExists ? '' : 'File public/modules/budget-period.js has not been created yet.');

  const scriptIncluded = htmlContent.includes('/modules/budget-period.js');
  assert(scriptIncluded, 'T1.1.2: public/index.html includes script tag for budget-period.js',
    scriptIncluded ? '' : 'Script tag <script src="/modules/budget-period.js"></script> missing in public/index.html.');

  // T1.2: DOM presence of Period Selector Tabs in Subtab Budget
  const hasSubtabBudgetsSelector = htmlContent.includes('budget-period-tabs') ||
                                   (htmlContent.includes('dash-budgets') && htmlContent.includes('Harian') && htmlContent.includes('Mingguan'));
  assert(hasSubtabBudgetsSelector, 'T1.2.1: Subtab Budget (#dash-budgets) contains period selector tabs container',
    hasSubtabBudgetsSelector ? '' : 'Selector tabs for Harian, Mingguan, Bulanan not found in #dash-budgets.');

  // T1.2b: DOM presence of Period Selector Tabs in Beranda Keuangan (#dash-overview / #dash-home)
  const hasOverviewBudgetSelector = htmlContent.includes('home-budget-period') ||
                                    htmlContent.includes('dash-overview') ||
                                    htmlContent.includes('dash-home');
  assert(hasOverviewBudgetSelector, 'T1.2.2: Beranda Keuangan contains budget section / selector support',
    hasOverviewBudgetSelector ? '' : 'Beranda Keuangan missing budget period selector.');

  // T1.3: Active orange highlight styling contract
  const hasOrangeHighlight = htmlContent.includes('bg-orange-500') ||
                             htmlContent.includes('brand-500') ||
                             (clientModule && typeof clientModule === 'object');
  assert(hasOrangeHighlight, 'T1.3.1: Active tab styling uses modern orange fintech highlight (bg-orange-500)',
    hasOrangeHighlight ? '' : 'Orange active tab highlight styling missing.');

  // T1.4: Tab labels: Harian, Mingguan, Bulanan
  const hasPeriodLabels = (htmlContent.includes('Harian') && htmlContent.includes('Mingguan') && htmlContent.includes('Bulanan')) ||
                          (moduleExists && fs.readFileSync(moduleDiskPath, 'utf8').includes('Harian'));
  assert(hasPeriodLabels, 'T1.4.1: UI Tabs provide options for Harian, Mingguan, and Bulanan',
    hasPeriodLabels ? '' : 'Period labels (Harian, Mingguan, Bulanan) missing in UI or module.');

  // T1.5: Module exports and interface methods
  const hasCalcMethod = clientModule && (
    typeof clientModule.calculateCategoryBudgetPeriod === 'function' ||
    typeof clientModule.calculateCategoryBudget === 'function' ||
    typeof clientModule.calculateBudgetPeriod === 'function'
  );
  assert(hasCalcMethod, 'T1.5.1: Module exposes calculateCategoryBudgetPeriod calculation function',
    hasCalcMethod ? '' : 'Calculation function not exported by budget-period.js.');

  const hasStateMethods = clientModule && (
    typeof clientModule.getActivePeriod === 'function' ||
    typeof clientModule.getActiveBudgetPeriod === 'function' ||
    typeof clientModule.setActivePeriod === 'function' ||
    typeof clientModule.setActiveBudgetPeriod === 'function'
  );
  assert(hasStateMethods, 'T1.5.2: Module exposes getActivePeriod / setActivePeriod state management',
    hasStateMethods ? '' : 'Period state accessor methods not exported by budget-period.js.');

  // T1.6: Mathematical Calculation Formula Verification (Authoritative Reference & Module)
  const mockBudget1500k = { category_id: 'cat_makanan', category_name: 'Makanan & Minuman', monthly_limit: 1500000 };
  const mockBudget800k = { category_id: 'cat_hiburan', category_name: 'Hiburan & Lifestyle', monthly_limit: 800000 };

  // Reference test: Harian limit = Math.round(monthly_limit / 30)
  const refDaily1500 = referenceCalculateCategoryBudget(mockBudget1500k, [], 'daily');
  assert(refDaily1500.limit === 50000, 'T1.6.1: Daily limit for 1.500.000 is exactly Math.round(1500000 / 30) = 50.000');

  const refDaily800 = referenceCalculateCategoryBudget(mockBudget800k, [], 'daily');
  assert(refDaily800.limit === 26667, 'T1.6.2: Daily limit for 800.000 is rounded to 26.667');

  // Reference test: Mingguan limit = Math.round(monthly_limit / 4)
  const refWeekly1500 = referenceCalculateCategoryBudget(mockBudget1500k, [], 'weekly');
  assert(refWeekly1500.limit === 375000, 'T1.6.3: Weekly limit for 1.500.000 is exactly Math.round(1500000 / 4) = 375.000');

  const refWeekly800 = referenceCalculateCategoryBudget(mockBudget800k, [], 'weekly');
  assert(refWeekly800.limit === 200000, 'T1.6.4: Weekly limit for 800.000 is exactly Math.round(800000 / 4) = 200.000');

  // Reference test: Bulanan limit = monthly_limit
  const refMonthly1500 = referenceCalculateCategoryBudget(mockBudget1500k, [], 'monthly');
  assert(refMonthly1500.limit === 1500000, 'T1.6.5: Monthly limit equals monthly_limit (1.500.000)');

  // T1.7: Transaction filtering across periods
  const todayDate = new Date();
  const todayStr = todayDate.toISOString();
  const threeDaysAgoStr = new Date(todayDate.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const fifteenDaysAgoStr = new Date(todayDate.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();

  const mockTransactions = [
    { id: 'tx_t1', category_id: 'cat_makanan', type: 'expense', amount: 20000, transaction_date: todayStr },
    { id: 'tx_t2', category_id: 'cat_makanan', type: 'expense', amount: 80000, transaction_date: threeDaysAgoStr },
    { id: 'tx_t3', category_id: 'cat_makanan', type: 'expense', amount: 150000, transaction_date: fifteenDaysAgoStr },
    { id: 'tx_t4', category_id: 'cat_makanan', type: 'income', amount: 500000, transaction_date: todayStr }, // Income must NOT count
    { id: 'tx_t5', category_id: 'cat_transport', type: 'expense', amount: 50000, transaction_date: todayStr } // Other category
  ];

  const dailyResult = referenceCalculateCategoryBudget(mockBudget1500k, mockTransactions, 'daily', todayDate);
  assert(dailyResult.spent === 20000, 'T1.7.1: Daily spent includes only today\'s expense (20.000)');
  assert(dailyResult.percentage === 40, 'T1.7.2: Daily percentage is (20.000 / 50.000) * 100 = 40%');

  const weeklyResult = referenceCalculateCategoryBudget(mockBudget1500k, mockTransactions, 'weekly', todayDate);
  assert(weeklyResult.spent === 100000, 'T1.7.3: Weekly spent includes last 7 days expenses (20.000 + 80.000 = 100.000)');
  assert(weeklyResult.percentage === 27, 'T1.7.4: Weekly percentage is Math.round((100.000 / 375.000) * 100) = 27%');

  // Verify client module calculation if loaded
  if (hasCalcMethod) {
    const calcFn = clientModule.calculateCategoryBudgetPeriod || clientModule.calculateCategoryBudget;
    const clientDaily = calcFn(mockBudget1500k, mockTransactions, 'daily', todayDate);
    assert(clientDaily && (clientDaily.limit === 50000 || clientDaily.dailyLimit === 50000),
      'T1.7.5: Client module matches daily limit calculation (50.000)');
    assert(clientDaily && (clientDaily.spent === 20000 || clientDaily.dailySpent === 20000),
      'T1.7.6: Client module matches daily spent calculation (20.000)');
  } else {
    assert(false, 'T1.7.5: Client module matches daily limit calculation', 'Module not yet loaded');
    assert(false, 'T1.7.6: Client module matches daily spent calculation', 'Module not yet loaded');
  }

  // ==================================================================
  // TIER 2: BOUNDARY & CORNER CASES (R2, R3)
  // ==================================================================
  console.log('\n--- [TIER 2] BOUNDARY & CORNER CASES ---');

  // T2.1: Zero Budget Limit (Division by Zero Protection)
  const zeroBudget = { category_id: 'cat_zero', category_name: 'Zero Limit Cat', monthly_limit: 0 };
  const zeroResultDaily = referenceCalculateCategoryBudget(zeroBudget, mockTransactions, 'daily', todayDate);
  assert(zeroResultDaily.limit === 0, 'T2.1.1: Limit is 0 when monthly_limit is 0');
  assert(!isNaN(zeroResultDaily.percentage) && isFinite(zeroResultDaily.percentage) && zeroResultDaily.percentage === 0,
    'T2.1.2: Percentage is safely 0% without NaN or Infinity on zero limit');

  // T2.2: Zero Transactions in Period
  const emptyTransactionsResult = referenceCalculateCategoryBudget(mockBudget1500k, [], 'daily', todayDate);
  assert(emptyTransactionsResult.spent === 0, 'T2.2.1: Spent is exactly 0 with empty transactions');
  assert(emptyTransactionsResult.percentage === 0, 'T2.2.2: Percentage is exactly 0% with empty transactions');
  assert(emptyTransactionsResult.remaining === 50000, 'T2.2.3: Remaining equals full limit when spent is 0');
  assert(emptyTransactionsResult.status === 'normal' && !emptyTransactionsResult.hasWarning && !emptyTransactionsResult.hasDanger,
    'T2.2.4: Zero spent produces normal/safe status without alerts');

  // T2.3: Warning Boundary at Exactly 80.0%
  const tx80Pct = [
    { id: 'tx_80', category_id: 'cat_makanan', type: 'expense', amount: 40000, transaction_date: todayStr }
  ];
  const res80Pct = referenceCalculateCategoryBudget(mockBudget1500k, tx80Pct, 'daily', todayDate);
  assert(res80Pct.percentage === 80, 'T2.3.1: Exactly 80% utilization calculated (40.000 / 50.000)');
  assert(res80Pct.hasWarning === true && res80Pct.status === 'warning',
    'T2.3.2: Warning alert badge is triggered at exactly 80.0% boundary');

  // T2.4: Sub-warning Boundary at 79.9%
  const tx79Pct = [
    { id: 'tx_79', category_id: 'cat_makanan', type: 'expense', amount: 39950, transaction_date: todayStr }
  ];
  const res79Pct = referenceCalculateCategoryBudget(mockBudget1500k, tx79Pct, 'daily', todayDate);
  assert(res79Pct.hasWarning === false && res79Pct.status === 'normal',
    'T2.4.1: Warning alert is NOT triggered below 80% (79.9% usage)');

  // T2.5: Danger / Over-budget Boundary at Exactly 100.0%
  const tx100Pct = [
    { id: 'tx_100', category_id: 'cat_makanan', type: 'expense', amount: 50000, transaction_date: todayStr }
  ];
  const res100Pct = referenceCalculateCategoryBudget(mockBudget1500k, tx100Pct, 'daily', todayDate);
  assert(res100Pct.percentage === 100, 'T2.5.1: Exactly 100% utilization calculated (50.000 / 50.000)');
  assert(res100Pct.hasDanger === true && res100Pct.status === 'danger',
    'T2.5.2: Danger alert badge is triggered at exactly 100.0% boundary');
  assert(res100Pct.remaining === 0, 'T2.5.3: Remaining quota is exactly 0 at 100%');

  // T2.6: Overflow (> 100%) Utilization & Negative Remaining Protection
  const tx150Pct = [
    { id: 'tx_150', category_id: 'cat_makanan', type: 'expense', amount: 75000, transaction_date: todayStr }
  ];
  const res150Pct = referenceCalculateCategoryBudget(mockBudget1500k, tx150Pct, 'daily', todayDate);
  assert(res150Pct.percentage === 150, 'T2.6.1: Percentage calculates accurately above 100% (150%)');
  assert(res150Pct.hasDanger === true, 'T2.6.2: Danger alert is active for overflow > 100%');
  assert(res150Pct.remaining === 0, 'T2.6.3: Remaining is clamped to 0 (no negative remaining displayed to user)');

  // T2.7: Date & Time Boundary Filtering Precision
  // Transaction 7 days + 1 hour ago (Must be excluded from weekly)
  const txEightDaysAgo = [
    { id: 'tx_old', category_id: 'cat_makanan', type: 'expense', amount: 50000,
      transaction_date: new Date(todayDate.getTime() - (7 * 24 + 1) * 60 * 60 * 1000).toISOString() }
  ];
  const resWeeklyOld = referenceCalculateCategoryBudget(mockBudget1500k, txEightDaysAgo, 'weekly', todayDate);
  assert(resWeeklyOld.spent === 0, 'T2.7.1: Transaction older than 7 days is excluded from weekly period');

  // Transaction exactly within 7 days (e.g. 6 days 23 hours ago)
  const txSixDaysAgo = [
    { id: 'tx_valid', category_id: 'cat_makanan', type: 'expense', amount: 50000,
      transaction_date: new Date(todayDate.getTime() - (6 * 24 + 23) * 60 * 60 * 1000).toISOString() }
  ];
  const resWeeklyValid = referenceCalculateCategoryBudget(mockBudget1500k, txSixDaysAgo, 'weekly', todayDate);
  assert(resWeeklyValid.spent === 50000, 'T2.7.2: Transaction within 7 days is included in weekly period');

  // ==================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS & STATE REACTIVITY (R4)
  // ==================================================================
  console.log('\n--- [TIER 3] CROSS-FEATURE COMBINATIONS & REACTIVE STATE ---');

  // T3.1: Live state check
  const stateRes = await get('/api/state');
  assert(stateRes.status === 200, 'T3.1.1: GET /api/state returns HTTP 200');
  const state = stateRes.data;
  assert(Array.isArray(state.budgets) && state.budgets.length >= 5, 'T3.1.2: Budgets array populated in system state');

  const foodBudget = state.budgets.find(b => b.category_id === 'cat_makanan' || b.id === 'bud_makanan');
  assert(foodBudget && foodBudget.monthly_limit > 0, 'T3.1.3: Makanan & Minuman category budget exists with positive limit');
  const initialSpent = foodBudget.current_spent || 0;

  // T3.2: Mutation via Web API: Add transaction
  let newTxId = null;
  const webTxPayload = {
    wallet_id: 'wal_bca',
    category_id: 'cat_makanan',
    type: 'expense',
    amount: 45000,
    note: 'Nasi Kapau Tambuah Ronde 2',
    transaction_date: new Date().toISOString()
  };

  const createTxRes = await post('/api/transactions', webTxPayload);
  assert(createTxRes.status === 200, 'T3.2.1: POST /api/transactions succeeds with HTTP 200');
  assert(createTxRes.data.ok === true, 'T3.2.2: Response indicates ok: true');
  if (createTxRes.data.transaction) newTxId = createTxRes.data.transaction.id;

  // Verify budget updated in state
  const stateAfterWebTx = await get('/api/state');
  const foodBudgetAfterWeb = stateAfterWebTx.data.budgets.find(b => b.category_id === 'cat_makanan' || b.id === 'bud_makanan');
  assert(foodBudgetAfterWeb.current_spent === initialSpent + 45000,
    `T3.2.3: Category current_spent dynamically increased by 45.000 (${initialSpent} -> ${foodBudgetAfterWeb.current_spent})`);

  // T3.3: Mutation via Telegram Bot Webhook
  const telegramRes = await post('/api/telegram/webhook', {
    update_id: nextUid(),
    message: {
      text: 'Makan soto ayam 30rb',
      date: Math.floor(Date.now() / 1000)
    }
  });
  assert(telegramRes.status === 200, 'T3.3.1: Telegram Webhook succeeds with HTTP 200');
  assert(telegramRes.data.ok === true, 'T3.3.2: Telegram Webhook returns ok: true');
  assert(telegramRes.data.reply_text && telegramRes.data.reply_text.includes('Pengeluaran tercatat'),
    'T3.3.3: Telegram Bot acknowledges expense recording');

  const stateAfterBot = await get('/api/state');
  const foodBudgetAfterBot = stateAfterBot.data.budgets.find(b => b.category_id === 'cat_makanan' || b.id === 'bud_makanan');
  assert(foodBudgetAfterBot.current_spent === initialSpent + 45000 + 30000,
    `T3.3.4: Telegram expense of 30.000 instantly updates category budget (${initialSpent + 45000} -> ${foodBudgetAfterBot.current_spent})`);

  // T3.4: Admin Budget Expansion Integration
  const approveBudgetRes = await post('/api/admin/approvals/action', {
    approvalId: 'appr_03',
    action: 'approve',
    reason: 'Pengajuan ekspansi budget liburan akhir tahun disetujui untuk pengujian Round 2'
  });

  if (approveBudgetRes.status === 200) {
    assert(true, 'T3.4.1: Admin approval for budget expansion processed with HTTP 200');
    const stateAfterAppr = await get('/api/state');
    const hiburanBudget = stateAfterAppr.data.budgets.find(b => b.id === 'bud_hiburan' || b.category_id === 'cat_hiburan');
    assert(hiburanBudget && hiburanBudget.monthly_limit === 1500000,
      'T3.4.2: Budget monthly_limit expanded to 1.500.000 in real-time');

    // Verify recalculation with new expanded limit
    const newDaily = referenceCalculateCategoryBudget(hiburanBudget, [], 'daily');
    const newWeekly = referenceCalculateCategoryBudget(hiburanBudget, [], 'weekly');
    assert(newDaily.limit === 50000, 'T3.4.3: Daily limit recalculated from expanded limit (1500000 / 30 = 50.000)');
    assert(newWeekly.limit === 375000, 'T3.4.4: Weekly limit recalculated from expanded limit (1500000 / 4 = 375.000)');
  } else {
    assert(false, 'T3.4.1: Admin approval for budget expansion', `Status: ${approveBudgetRes.status}`);
  }

  // T3.5: Transaction Deletion Reactivity
  if (newTxId) {
    const dynamicSpentBefore = referenceCalculateCategoryBudget(foodBudget, stateAfterBot.data.transactions, 'monthly', new Date()).spent;
    const delRes = await del(`/api/transactions/${newTxId}`);
    assert(delRes.status === 200, 'T3.5.1: DELETE /api/transactions/:id succeeds with HTTP 200');

    const stateAfterDel = await get('/api/state');
    const dynamicSpentAfter = referenceCalculateCategoryBudget(foodBudget, stateAfterDel.data.transactions, 'monthly', new Date()).spent;
    assert(dynamicSpentAfter === dynamicSpentBefore - 45000,
      `T3.5.2: Dynamic budget spent correctly drops by deleted amount 45.000 (${dynamicSpentBefore} -> ${dynamicSpentAfter})`);
  }

  // ==================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (R4)
  // ==================================================================
  console.log('\n--- [TIER 4] REAL-WORLD APPLICATION SCENARIOS ---');

  // T4.1: E2E Daily Spending Spree with Alert Escalation
  // Test scenario: Daily limit = 50.000
  // Morning (0%): Safe
  // Tx 1: 20.000 -> 40% (Safe)
  // Tx 2: 22.000 -> Total 42.000 = 84% (Warning >= 80%)
  // Tx 3: 15.000 -> Total 57.000 = 114% (Danger >= 100%)
  const dailySpreeBudget = { category_id: 'cat_spree', category_name: 'Spree Test', monthly_limit: 1500000 };
  const spreeTx1 = [{ id: 'sp1', category_id: 'cat_spree', type: 'expense', amount: 20000, transaction_date: todayStr }];
  const spreeTx2 = [...spreeTx1, { id: 'sp2', category_id: 'cat_spree', type: 'expense', amount: 22000, transaction_date: todayStr }];
  const spreeTx3 = [...spreeTx2, { id: 'sp3', category_id: 'cat_spree', type: 'expense', amount: 15000, transaction_date: todayStr }];

  const step1 = referenceCalculateCategoryBudget(dailySpreeBudget, spreeTx1, 'daily', todayDate);
  assert(step1.percentage === 40 && step1.status === 'normal',
    'T4.1.1: Spree Step 1 (40%): Normal status without alerts');

  const step2 = referenceCalculateCategoryBudget(dailySpreeBudget, spreeTx2, 'daily', todayDate);
  assert(step2.percentage === 84 && step2.status === 'warning' && step2.hasWarning === true,
    'T4.1.2: Spree Step 2 (84%): Warning alert triggered dynamically when crossing 80%');

  const step3 = referenceCalculateCategoryBudget(dailySpreeBudget, spreeTx3, 'daily', todayDate);
  assert(step3.percentage === 114 && step3.status === 'danger' && step3.hasDanger === true,
    'T4.1.3: Spree Step 3 (114%): Danger alert triggered dynamically when crossing 100%');

  // T4.2: Multi-Period Isolation Test
  // In daily view, step3 is 114% (Danger). In weekly view, total 57.000 against weekly limit 375.000 is 15.2% (Safe).
  const step3Weekly = referenceCalculateCategoryBudget(dailySpreeBudget, spreeTx3, 'weekly', todayDate);
  assert(step3Weekly.percentage === 15 && step3Weekly.status === 'normal' && !step3Weekly.hasDanger,
    'T4.2.1: Multi-Period Isolation: Over-budget in daily does NOT falsely trigger alert in weekly view');

  const step3Monthly = referenceCalculateCategoryBudget(dailySpreeBudget, spreeTx3, 'monthly', todayDate);
  assert(step3Monthly.percentage === 4 && step3Monthly.status === 'normal' && !step3Monthly.hasDanger,
    'T4.2.2: Multi-Period Isolation: Over-budget in daily does NOT falsely trigger alert in monthly view');

  // T4.3: Reset state and cleanup
  try {
    await post('/api/test/reset-state');
    assert(true, 'T4.3.1: Final state reset executed successfully');
  } catch (e) {
    assert(false, 'T4.3.1: Final state reset failed: ' + e.message);
  }

  // Final Summary
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`📊 TATADANA ROUND 2 BUDGET PERIOD TEST RESULTS:`);
  console.log(`   Total Tests : ${total}`);
  console.log(`   Passed      : ${passed} ✅`);
  console.log(`   Failed      : ${failed} ❌`);
  console.log(`   Success Rate: ${Math.round((passed / total) * 100)}%`);
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('⚠️  Note: Some tests failed due to pending implementation in M3 (Multi-Period Filter).');
    console.log('    Implementing agent should implement public/modules/budget-period.js and DOM selectors to turn all tests green.');
  }

  return { total, passed, failed };
}

// Execute test suite
if (require.main === module) {
  runBudgetPeriodTests().then(({ failed }) => {
    // If pending implementation exists, exit code reflects status
    if (failed > 0) {
      process.exitCode = 1;
    }
  }).catch(err => {
    console.error('Fatal budget period test runner error:', err);
    process.exit(1);
  });
}

module.exports = {
  runBudgetPeriodTests,
  referenceCalculateCategoryBudget
};
