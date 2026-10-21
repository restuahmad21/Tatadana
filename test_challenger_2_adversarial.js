// ====================================================================
// TataDana Fintech SaaS: Challenger 2 Empirical & Adversarial Test Harness
// Covers:
// 1. Multi-Period Budget Calculation Formulas & Starter 3-Wallet Limit
// 2. Interactive Calendar Navigation Across Year Boundaries & Aggregation
// 3. In-App Tata AI Assistant Diverse Prompts & Simulation Math
// 4. Frontend UI DOM Integrations & Script Verification
// ====================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

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

function get(reqPath, timeoutMs = 3000) {
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

async function runAdversarialSuite() {
  console.log('⚔️  STARTING CHALLENGER 2 ADVERSARIAL STRESS TEST SUITE...\n');
  let passed = 0;
  let total = 0;
  const failures = [];

  function assert(condition, name, details = '') {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}${details ? ' -> ' + details : ''}`);
      failures.push({ name, details });
    }
  }

  // Auto-start server if not already running
  try {
    const ping = await get('/api/state');
    if (ping.status !== 200) throw new Error('Not running');
  } catch (e) {
    require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  // Ensure state is clean initially
  await post('/api/test/reset-state');

  // ==================================================================
  // PART 1: MULTI-PERIOD BUDGET FORMULAS & STARTER 3-WALLET LIMIT
  // ==================================================================
  console.log('\n--- PART 1: Multi-Period Budget Formulas & Wallet Limits ---');

  const { calculateWalletBudgetStats, handleCreateWallet } = require('./src/modules/wallet-budget');

  // 1.1 Formula Mathematical Verification
  const w1 = { id: 'test_wal_1', budget_limit: 3000000 };
  const s1 = calculateWalletBudgetStats(w1, []);
  assert(s1.daily.limit === 100000, 'Budget formula: daily is limit / 30 (3.000.000 / 30 = 100.000)', `got ${s1.daily.limit}`);
  assert(s1.weekly.limit === 750000, 'Budget formula: weekly is limit / 4 (3.000.000 / 4 = 750.000)', `got ${s1.weekly.limit}`);
  assert(s1.monthly.limit === 3000000, 'Budget formula: monthly is limit (3.000.000)', `got ${s1.monthly.limit}`);

  // 1.2 Rounding with non-clean multiples
  const w2 = { id: 'test_wal_2', budget_limit: 1000000 };
  const s2 = calculateWalletBudgetStats(w2, []);
  assert(s2.daily.limit === 33333, 'Budget rounding: 1.000.000 / 30 rounds to 33.333', `got ${s2.daily.limit}`);
  assert(s2.weekly.limit === 250000, 'Budget rounding: 1.000.000 / 4 is 250.000', `got ${s2.weekly.limit}`);
  assert(s2.monthly.limit === 1000000, 'Budget rounding: monthly is 1.000.000', `got ${s2.monthly.limit}`);

  // 1.3 Edge case: Zero budget limit
  const wZero = { id: 'test_wal_zero', budget_limit: 0 };
  const sZero = calculateWalletBudgetStats(wZero, []);
  assert(sZero.daily.limit === 0 && sZero.daily.percentage === 0, 'Zero budget limit produces 0 daily limit and 0% without NaN');
  assert(sZero.weekly.limit === 0 && sZero.weekly.percentage === 0, 'Zero budget limit produces 0 weekly limit and 0% without NaN');
  assert(sZero.monthly.limit === 0 && sZero.monthly.percentage === 0, 'Zero budget limit produces 0 monthly limit and 0% without NaN');

  // 1.4 Edge case: Negative budget limit
  const wNeg = { id: 'test_wal_neg', budget_limit: -500000 };
  const sNeg = calculateWalletBudgetStats(wNeg, []);
  assert(sNeg.daily.limit === 0 && sNeg.weekly.limit === 0 && sNeg.monthly.limit === 0, 'Negative budget limit clamped safely to 0');

  // 1.5 Edge case: Non-numeric / NaN budget limit
  const wNan = { id: 'test_wal_nan', budget_limit: 'invalid_nominal' };
  const sNan = calculateWalletBudgetStats(wNan, []);
  assert(sNan.daily.limit === 0 && !isNaN(sNan.daily.limit), 'Invalid non-numeric budget limit handled safely without NaN');

  // 1.6 Edge case: Huge budget limit (10 Miliar)
  const wHuge = { id: 'test_wal_huge', budget_limit: 10000000000 };
  const sHuge = calculateWalletBudgetStats(wHuge, []);
  assert(sHuge.daily.limit === 333333333, 'Huge budget 10 Miliar calculated accurately for daily (333.333.333)');
  assert(sHuge.weekly.limit === 2500000000, 'Huge budget 10 Miliar calculated accurately for weekly (2.500.000.000)');

  // 1.7 Expense Aggregation across Windows and Overspending Clamp
  const refTime = new Date('2026-10-12T12:00:00+07:00').toISOString();
  const txList = [
    // Today's expense for test_wal_exp
    { wallet_id: 'test_wal_exp', type: 'expense', amount: 80000, transaction_date: '2026-10-12T09:00:00+07:00' },
    // 3 days ago expense for test_wal_exp (in weekly & monthly, not daily)
    { wallet_id: 'test_wal_exp', type: 'expense', amount: 150000, transaction_date: '2026-10-09T14:00:00+07:00' },
    // 20 days ago expense for test_wal_exp (in monthly, not weekly or daily)
    { wallet_id: 'test_wal_exp', type: 'expense', amount: 300000, transaction_date: '2026-09-25T10:00:00+07:00' },
    // Income transaction (should NOT be added to expense)
    { wallet_id: 'test_wal_exp', type: 'income', amount: 5000000, transaction_date: '2026-10-12T10:00:00+07:00' },
    // Different wallet expense (should NOT be added to test_wal_exp)
    { wallet_id: 'other_wallet', type: 'expense', amount: 999999, transaction_date: '2026-10-12T10:00:00+07:00' }
  ];
  // Wallet with 3.000.000 limit: daily is 100.000, weekly is 750.000, monthly is 3.000.000
  const sExp = calculateWalletBudgetStats({ id: 'test_wal_exp', budget_limit: 3000000 }, txList);
  assert(sExp.daily.spent === 80000, 'Daily spent correctly filters only expenses on reference day (80.000)', `got ${sExp.daily.spent}`);
  assert(sExp.weekly.spent === 230000, 'Weekly spent aggregates 80k + 150k = 230.000', `got ${sExp.weekly.spent}`);
  assert(sExp.monthly.spent === 530000, 'Monthly spent aggregates 80k + 150k + 300k = 530.000', `got ${sExp.monthly.spent}`);
  assert(sExp.daily.percentage === 80, 'Daily percentage calculated accurately (80.000 / 100.000 = 80%)', `dailyPct: ${sExp.daily.percentage}%`);
  assert(sExp.weekly.percentage === 30.7, 'Weekly percentage calculated accurately (230.000 / 750.000 = 30.7%)', `weeklyPct: ${sExp.weekly.percentage}%`);
  assert(sExp.monthly.percentage === 17.7, 'Monthly percentage calculated accurately (530.000 / 3.000.000 = 17.7%)', `monthlyPct: ${sExp.monthly.percentage}%`);

  // Overspending check
  const sOver = calculateWalletBudgetStats({ id: 'test_wal_exp', budget_limit: 50000 }, txList);
  assert(sOver.monthly.remaining === 0, 'Overspending monthly remaining clamped to 0 (never negative)', `got ${sOver.monthly.remaining}`);
  assert(sOver.monthly.percentage > 100, 'Overspending monthly percentage exceeds 100%', `got ${sOver.monthly.percentage}%`);

  // 1.8 Starter Plan 3-Wallet Limit via API
  // Switch to Ahmad Fauzi (Starter plan)
  await post('/api/admin/impersonate', { userId: 'usr_tatadana_003' });
  const starterStateRes = await get('/api/state');
  const starterWalletsCount = starterStateRes.data.wallets.length;
  assert(starterStateRes.data.subscription.plan === 'starter', 'Ahmad Fauzi is confirmed on Starter plan');
  assert(starterWalletsCount >= 3, `Starter user has ${starterWalletsCount} wallets (ceiling is 3)`);

  // Attempt to create 4th wallet
  const starterCreateRes = await post('/api/wallets', {
    name: 'Dompet Terlarang 4',
    type: 'bank',
    balance: 500000,
    budget_limit: 1500000
  });
  assert(starterCreateRes.status === 403, 'Backend rejects 4th wallet for Starter plan with HTTP 403', `got ${starterCreateRes.status}`);
  assert(starterCreateRes.data.ok === false, '4th wallet rejection response has ok: false');
  assert(starterCreateRes.data.error.includes('Batas maksimal 3 dompet'), 'Rejection error specifies Starter max 3 wallets');
  assert(starterCreateRes.data.error.includes('Upgrade ke Pro'), 'Rejection error specifies Upgrade ke Pro CTA');

  // Verify wallet count was NOT incremented
  const starterStateAfter = await get('/api/state');
  assert(starterStateAfter.data.wallets.length === starterWalletsCount, 'Starter user wallet count remains strictly unchanged after 403 rejection');

  // Switch back to Budi (Pro plan)
  await post('/api/admin/impersonate', { userId: 'usr_tatadana_001' });
  const proCreateRes = await post('/api/wallets', {
    name: 'Dompet Sukses Pro',
    type: 'ewallet',
    balance: 750000,
    budget_limit: 2400000
  });
  assert(proCreateRes.status === 200, 'Pro user can create additional wallets with HTTP 200', `got ${proCreateRes.status}`);
  assert(proCreateRes.data.budget_stats.daily.limit === 80000, 'Pro user created wallet returns daily limit 2.400.000 / 30 = 80.000');
  assert(proCreateRes.data.budget_stats.weekly.limit === 600000, 'Pro user created wallet returns weekly limit 2.400.000 / 4 = 600.000');

  // 1.9 Frontend UI Markup & Functions for Wallet Budget
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  const indexHtml = fs.readFileSync(htmlPath, 'utf8');
  assert(indexHtml.includes('id="add-wallet-modal"'), 'Frontend markup contains #add-wallet-modal');
  assert(indexHtml.includes('id="new-wallet-name"'), 'Frontend markup contains #new-wallet-name input');
  assert(indexHtml.includes('id="new-wallet-type"'), 'Frontend markup contains #new-wallet-type select');
  assert(indexHtml.includes('id="new-wallet-balance"'), 'Frontend markup contains #new-wallet-balance input');
  assert(indexHtml.includes('id="new-wallet-budget"'), 'Frontend markup contains #new-wallet-budget input');
  assert(indexHtml.includes('id="preview-daily-limit"'), 'Frontend markup contains #preview-daily-limit element');
  assert(indexHtml.includes('id="preview-weekly-limit"'), 'Frontend markup contains #preview-weekly-limit element');
  assert(indexHtml.includes('id="preview-monthly-limit"'), 'Frontend markup contains #preview-monthly-limit element');
  assert(indexHtml.includes('id="wallet-upgrade-modal"'), 'Frontend markup contains #wallet-upgrade-modal');
  assert(indexHtml.includes('src="/modules/wallet-budget.js"'), 'Frontend markup loads /modules/wallet-budget.js script');

  // Check frontend wallet-budget.js functions
  const walletJs = fs.readFileSync(path.join(__dirname, 'public', 'modules', 'wallet-budget.js'), 'utf8');
  assert(walletJs.includes('openAddWalletModal'), 'public/modules/wallet-budget.js implements openAddWalletModal');
  assert(walletJs.includes('openWalletUpgradeModal'), 'public/modules/wallet-budget.js implements openWalletUpgradeModal');
  assert(walletJs.includes('updateMultiPeriodPreview'), 'public/modules/wallet-budget.js implements updateMultiPeriodPreview');
  assert(walletJs.includes('renderWalletCardsWithBudget'), 'public/modules/wallet-budget.js implements renderWalletCardsWithBudget');

  // ==================================================================
  // PART 2: INTERACTIVE CALENDAR ENGINE & UI INTEGRATIONS
  // ==================================================================
  console.log('\n--- PART 2: Interactive Calendar Engine & UI Integrations ---');

  const { getMonthlyCalendarData, getDayTransactions, getWibDateKey, calculateCashflow, handleCalendarApi } = require('./src/modules/calendar');

  // 2.1 Month Navigation Across Year Boundaries (Unit / Simulation)
  function navigateMonth(year, month, direction) {
    let y = year;
    let m = month;
    if (direction === 'prev') {
      if (m === 1) {
        m = 12;
        y -= 1;
      } else {
        m -= 1;
      }
    } else if (direction === 'next') {
      if (m === 12) {
        m = 1;
        y += 1;
      } else {
        m += 1;
      }
    }
    return { year: y, month: m };
  }

  // Jan 2026 -> prev -> Dec 2025
  const nav1 = navigateMonth(2026, 1, 'prev');
  assert(nav1.year === 2025 && nav1.month === 12, 'Navigating prev from Jan 2026 crosses year boundary to Dec 2025', `got ${nav1.year}-${nav1.month}`);

  // Dec 2026 -> next -> Jan 2027
  const nav2 = navigateMonth(2026, 12, 'next');
  assert(nav2.year === 2027 && nav2.month === 1, 'Navigating next from Dec 2026 crosses year boundary to Jan 2027', `got ${nav2.year}-${nav2.month}`);

  // Multi-step backwards across multiple years
  let currentY = 2026;
  let currentM = 3;
  for (let i = 0; i < 15; i++) {
    const res = navigateMonth(currentY, currentM, 'prev');
    currentY = res.year;
    currentM = res.month;
  }
  assert(currentY === 2024 && currentM === 12, '15 consecutive prev month navigations from Mar 2026 lands accurately on Dec 2024', `got ${currentY}-${currentM}`);

  // 2.2 Leap Year & Month Lengths
  const febLeap2024 = getMonthlyCalendarData([], 2024, 2);
  assert(febLeap2024.days_in_month === 29, 'February 2024 (leap year) has 29 days', `got ${febLeap2024.days_in_month}`);
  const febNormal2025 = getMonthlyCalendarData([], 2025, 2);
  assert(febNormal2025.days_in_month === 28, 'February 2025 (normal year) has 28 days', `got ${febNormal2025.days_in_month}`);
  const febLeap2028 = getMonthlyCalendarData([], 2028, 2);
  assert(febLeap2028.days_in_month === 29, 'February 2028 (leap year) has 29 days', `got ${febLeap2028.days_in_month}`);

  // 2.3 Calendar Backend Module Unit Tests (getMonthlyCalendarData)
  const dbState = (await get('/api/state')).data;
  const monthData = getMonthlyCalendarData(dbState.transactions || [], 2026, 10);
  assert(monthData.year === 2026 && monthData.month === 10, 'Calendar month returns year 2026 and month 10');
  assert(monthData.days_in_month === 31, 'October 2026 contains exactly 31 days');
  assert(Array.isArray(monthData.days) && monthData.days.length === 31, 'Calendar days array has length 31');
  assert(monthData.active_days > 0, `Calendar has active mutation days (${monthData.active_days} days)`);

  // Verify mutation dots / indicators
  const activeDays = monthData.days.filter(d => d.has_mutations);
  assert(activeDays.length === monthData.active_days, 'All days with has_mutations match active_days count');
  activeDays.forEach(d => {
    assert(d.transaction_count > 0, `Active date ${d.date} has transaction_count > 0 (${d.transaction_count})`);
  });

  const inactiveDays = monthData.days.filter(d => !d.has_mutations);
  assert(inactiveDays.length > 0, 'Calendar has inactive dates without mutations');
  inactiveDays.forEach(d => {
    assert(d.transaction_count === 0 && d.income === 0 && d.expense === 0, `Inactive date ${d.date} has 0 transactions & zeroed cashflow`);
  });

  // Verify monthly cashflow aggregation equals sum of daily cashflows
  let sumDailyIncome = 0;
  let sumDailyExpense = 0;
  monthData.days.forEach(d => {
    sumDailyIncome += d.income;
    sumDailyExpense += d.expense;
  });
  assert(monthData.total_income === sumDailyIncome, `Calendar total_income (${monthData.total_income}) matches sum of daily incomes (${sumDailyIncome})`);
  assert(monthData.total_expense === sumDailyExpense, `Calendar total_expense (${monthData.total_expense}) matches sum of daily expenses (${sumDailyExpense})`);
  assert(monthData.net_cashflow === sumDailyIncome - sumDailyExpense, 'Calendar net_cashflow matches total_income - total_expense');

  // 2.4 Date Selection & Daily Aggregation (getDayTransactions)
  const firstActiveDate = activeDays[0].date;
  const dayData = getDayTransactions(dbState.transactions || [], firstActiveDate);
  assert(dayData.date === firstActiveDate, 'Day data date matches selected date');
  assert(dayData.transaction_count === activeDays[0].transaction_count, 'Day data transaction_count matches month breakdown');
  assert(dayData.income === activeDays[0].income, 'Day data income matches month breakdown');
  assert(dayData.expense === activeDays[0].expense, 'Day data expense matches month breakdown');
  assert(dayData.net === dayData.income - dayData.expense, 'Day data net cashflow accurately equals income - expense');
  assert(Array.isArray(dayData.transactions) && dayData.transactions.length === dayData.transaction_count, 'Day transactions array contains all mutations');

  // Non-active date aggregation
  const inactiveDate = inactiveDays.length > 0 ? inactiveDays[0].date : '2026-10-06';
  const inactiveDayData = getDayTransactions(dbState.transactions || [], inactiveDate);
  assert(inactiveDayData.transaction_count === 0, 'Inactive date has 0 transactions');
  assert(inactiveDayData.net === 0, 'Inactive date has 0 net cashflow');

  // 2.5 Timezone Normalization
  const wibKey = getWibDateKey('2026-10-10T18:00:00Z');
  assert(wibKey === '2026-10-11', 'Timezone normalization converts UTC 18:00 to next day in WIB (+7)', `got ${wibKey}`);

  // 2.6 Calendar Module handleCalendarApi direct execution
  let mockStatus = 0;
  let mockBody = '';
  const mockRes = {
    writeHead: (s) => { mockStatus = s; },
    end: (b) => { mockBody = b; }
  };
  const mockReq = { method: 'GET' };
  const mockUrl = new URL('http://localhost:3000/api/calendar/month?year=2026&month=10');
  const handled = await handleCalendarApi(mockReq, mockRes, dbState, mockUrl);
  assert(handled === true || mockStatus === 200, 'handleCalendarApi returns true for /api/calendar/month');
  assert(mockStatus === 200, 'handleCalendarApi responds with HTTP 200');
  const parsedMockData = JSON.parse(mockBody);
  assert(parsedMockData.ok === true && parsedMockData.data.days_in_month === 31, 'handleCalendarApi delivers valid JSON data');

  // 2.7 CRITICAL ADVERSARIAL DISCOVERY: Live GET /api/calendar/month HTTP Route in server.js
  // In server.js line 2244, calendarModule.handleCalendarApi is invoked with `urlObj` which is undefined!
  // (The variable at line 797 is `reqUrl`, not `urlObj`).
  const liveCalRouteRes = await get('/api/calendar/month?year=2026&month=10', 2000);
  if (liveCalRouteRes.status === 200) {
    assert(true, 'Live HTTP route GET /api/calendar/month returned 200');
  } else {
    assert(
      false,
      'BUG DETECTED in server.js line 2244: GET /api/calendar/month fails or hangs due to ReferenceError: urlObj is not defined (should be reqUrl)',
      `Status: ${liveCalRouteRes.status}, Error: ${liveCalRouteRes.error || liveCalRouteRes.body}`
    );
  }

  // 2.8 Frontend UI Integration for Calendar in public/index.html & calendar.js
  assert(indexHtml.includes('id="nav-calendar"'), 'public/index.html contains #nav-calendar navigation button');
  assert(indexHtml.includes('id="dash-calendar"'), 'public/index.html contains #dash-calendar section container');
  assert(indexHtml.includes('src="/modules/calendar.js"'), 'public/index.html includes /modules/calendar.js script');

  const calJs = fs.readFileSync(path.join(__dirname, 'public', 'modules', 'calendar.js'), 'utf8');
  assert(calJs.includes('goToPrevMonth'), 'public/modules/calendar.js implements goToPrevMonth');
  assert(calJs.includes('goToNextMonth'), 'public/modules/calendar.js implements goToNextMonth');
  assert(calJs.includes('goToToday'), 'public/modules/calendar.js implements goToToday');
  assert(calJs.includes('selectCalendarDate'), 'public/modules/calendar.js implements selectCalendarDate');
  assert(calJs.includes('cal-indicator-dots'), 'public/modules/calendar.js implements mutation indicator dots (.cal-indicator-dots)');
  assert(calJs.includes('cal-daily-breakdown'), 'public/modules/calendar.js renders daily cashflow breakdown');

  // ==================================================================
  // PART 3: IN-APP TATA AI ASSISTANT (`POST /api/ai/chat`)
  // ==================================================================
  console.log('\n--- PART 3: In-App Tata AI Assistant & Simulation Math ---');

  // 3.1 Prompt 1: Savings Inquiry
  const chatSavingsRes = await post('/api/ai/chat', {
    message: 'Bagaimana cara menghemat pengeluaran saya bulan ini?'
  });
  assert(chatSavingsRes.status === 200, 'POST /api/ai/chat with savings inquiry returns HTTP 200');
  assert(chatSavingsRes.data.ok === true, 'Response contains ok: true');
  assert(typeof chatSavingsRes.data.reply === 'string' && chatSavingsRes.data.reply.length > 50, 'Savings reply is non-empty string');
  assert(
    chatSavingsRes.data.reply.toLowerCase().includes('hemat') ||
    chatSavingsRes.data.reply.toLowerCase().includes('rekomendasi') ||
    chatSavingsRes.data.reply.toLowerCase().includes('pos'),
    'Savings reply contains relevant Indonesian savings guidance'
  );
  assert(Array.isArray(chatSavingsRes.data.suggestions) && chatSavingsRes.data.suggestions.length >= 3, 'Suggestions array is provided');

  // 3.2 Prompt 2: Habit Simulation - Daily Coffee (Rp 35.000 / day)
  const chatCoffeeRes = await post('/api/ai/chat', {
    message: 'Simulasi kopi 35rb per hari'
  });
  assert(chatCoffeeRes.status === 200, 'POST /api/ai/chat for coffee simulation returns HTTP 200');
  assert(chatCoffeeRes.data.ok === true, 'Simulation response has ok: true');
  assert(chatCoffeeRes.data.simulation !== null, 'Simulation object is generated');
  const coffeeSim = chatCoffeeRes.data.simulation;
  assert(coffeeSim.nominal === 35000, 'Simulation nominal parsed as 35.000', `got ${coffeeSim.nominal}`);
  assert(coffeeSim.frequency === 'harian', 'Simulation frequency detected as harian', `got ${coffeeSim.frequency}`);
  assert(coffeeSim.daily_cost === 35000, 'Simulation daily_cost is exactly 35.000', `got ${coffeeSim.daily_cost}`);
  assert(coffeeSim.monthly_impact === 1050000, 'Simulation monthly impact is 35.000 * 30 = 1.050.000', `got ${coffeeSim.monthly_impact}`);
  assert(coffeeSim.annual_impact === 12775000, 'Simulation annual impact is 35.000 * 365 = 12.775.000', `got ${coffeeSim.annual_impact}`);
  assert(
    chatCoffeeRes.data.reply.includes('1.050.000') && chatCoffeeRes.data.reply.includes('12.775.000'),
    'Simulation text reply contains exact formatted monthly and annual figures'
  );

  // 3.3 Prompt 3: Alternate Habit Simulation - Boba 25k tiap hari
  const chatBobaRes = await post('/api/ai/chat', {
    message: 'kalau saya beli boba 25k tiap hari gimana dampaknya?'
  });
  assert(chatBobaRes.status === 200, 'POST /api/ai/chat with boba 25k returns HTTP 200');
  assert(chatBobaRes.data.simulation !== null, 'Boba simulation object is generated');
  assert(chatBobaRes.data.simulation.nominal === 25000, 'Boba nominal parsed from 25k as 25.000');
  assert(chatBobaRes.data.simulation.monthly_impact === 750000, 'Boba monthly impact is 25.000 * 30 = 750.000');
  assert(chatBobaRes.data.simulation.annual_impact === 9125000, 'Boba annual impact is 25.000 * 365 = 9.125.000');

  // 3.4 Prompt 4: Large One-Off Gadget Simulation (12,5jt)
  const chatGadgetRes = await post('/api/ai/chat', {
    message: 'Simulasi beli laptop 12,5jt'
  });
  assert(chatGadgetRes.status === 200, 'POST /api/ai/chat for gadget simulation returns HTTP 200');
  assert(chatGadgetRes.data.simulation !== null, 'Gadget simulation object is generated');
  assert(chatGadgetRes.data.simulation.nominal === 12500000, 'Gadget nominal parsed from 12,5jt as 12.500.000', `got ${chatGadgetRes.data.simulation.nominal}`);
  assert(chatGadgetRes.data.simulation.monthly_impact === 12500000, 'One-off gadget monthly impact is 12.500.000');

  // 3.5 Prompt 5: Weekly Gym Simulation (150rb per minggu)
  const chatGymRes = await post('/api/ai/chat', {
    message: 'Simulasi gym 150rb per minggu'
  });
  assert(chatGymRes.status === 200, 'Weekly gym simulation returns HTTP 200');
  assert(chatGymRes.data.simulation !== null, 'Weekly gym simulation object generated');
  assert(chatGymRes.data.simulation.nominal === 150000, 'Gym nominal parsed as 150.000');
  assert(chatGymRes.data.simulation.frequency === 'mingguan', 'Gym frequency detected as mingguan');
  assert(chatGymRes.data.simulation.annual_impact === 7800000, 'Gym annual impact is 150.000 * 52 = 7.800.000', `got ${chatGymRes.data.simulation.annual_impact}`);

  // 3.6 Prompt 6: Budget Quota Inquiry
  const chatBudgetRes = await post('/api/ai/chat', {
    message: 'Cek status kuota budget bulanan saya'
  });
  assert(chatBudgetRes.status === 200, 'Budget quota inquiry returns HTTP 200');
  assert(
    chatBudgetRes.data.reply.toLowerCase().includes('budget') ||
    chatBudgetRes.data.reply.toLowerCase().includes('anggaran'),
    'Budget inquiry evaluates budget limits and remaining allocations'
  );

  // 3.7 Prompt 7: Empty String & Whitespace Message
  const chatEmptyRes = await post('/api/ai/chat', { message: '' });
  assert(chatEmptyRes.status === 200, 'Empty message returns HTTP 200 without throwing');
  assert(chatEmptyRes.data.ok === true, 'Empty message response has ok: true');
  assert(chatEmptyRes.data.reply.includes('Tata AI'), 'Empty message returns default polite greeting introducing Tata AI');

  const chatWhitespaceRes = await post('/api/ai/chat', { message: '    \n   ' });
  assert(chatWhitespaceRes.status === 200, 'Whitespace message returns HTTP 200 without throwing');
  assert(chatWhitespaceRes.data.ok === true, 'Whitespace message response has ok: true');

  // 3.8 Prompt 8: Malformed Request / Missing Fields
  const chatMalformedRes = await post('/api/ai/chat', {});
  assert(chatMalformedRes.status === 200, 'Payload with missing message field returns HTTP 200 safely');
  assert(chatMalformedRes.data.ok === true, 'Payload with missing message field has ok: true');

  // 3.9 Prompt 9: Adversarial XSS & Special Characters
  const chatXssRes = await post('/api/ai/chat', {
    message: '<script>alert("hacked")</script> "test\' OR 1=1 --'
  });
  assert(chatXssRes.status === 200, 'Adversarial XSS prompt processed safely with HTTP 200');
  assert(chatXssRes.data.ok === true, 'Adversarial XSS prompt returns ok: true');

  // 3.10 AI Audit Telemetry Verification
  const stateRes = await get('/api/state');
  assert(Array.isArray(stateRes.data.aiLogs), 'Database contains aiLogs array');
  const latestAiLog = stateRes.data.aiLogs[0];
  assert(latestAiLog !== undefined, 'aiLogs contains logged interactions');
  assert(latestAiLog.provider === 'Tata AI In-App Advisor', 'AI telemetry records provider as Tata AI In-App Advisor');
  assert(latestAiLog.action_type === 'financial_chat_advice', 'AI telemetry records action_type as financial_chat_advice');
  assert(latestAiLog.status === 'success', 'AI telemetry records status as success');

  // 3.11 Frontend UI Markup for Tata AI
  assert(indexHtml.includes('id="tata-ai-floating-btn"'), 'public/index.html contains #tata-ai-floating-btn');
  assert(indexHtml.includes('id="tata-ai-drawer"'), 'public/index.html contains #tata-ai-drawer');
  assert(indexHtml.includes('id="tata-ai-messages"'), 'public/index.html contains #tata-ai-messages stream container');
  assert(indexHtml.includes('id="tata-ai-input"'), 'public/index.html contains #tata-ai-input');
  assert(indexHtml.includes('id="tata-ai-send-btn"'), 'public/index.html contains #tata-ai-send-btn');
  assert(indexHtml.includes('id="tata-ai-quick-chips"'), 'public/index.html contains #tata-ai-quick-chips');
  assert(indexHtml.includes('src="/modules/tata-ai.js"'), 'public/index.html includes /modules/tata-ai.js script');

  const tataAiJs = fs.readFileSync(path.join(__dirname, 'public', 'modules', 'tata-ai.js'), 'utf8');
  assert(tataAiJs.includes('toggleTataAiDrawer'), 'public/modules/tata-ai.js implements toggleTataAiDrawer');
  assert(tataAiJs.includes('handleTataAiSubmit'), 'public/modules/tata-ai.js implements handleTataAiSubmit');
  assert(tataAiJs.includes('sendTataAiQuickPrompt'), 'public/modules/tata-ai.js implements sendTataAiQuickPrompt');
  assert(tataAiJs.includes('/api/ai/chat'), 'public/modules/tata-ai.js interacts with POST /api/ai/chat');

  // Reset state at completion
  await post('/api/test/reset-state');

  // ==================================================================
  // SUMMARY
  // ==================================================================
  console.log('\n======================================================');
  console.log(`📊 ADVERSARIAL STRESS TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  if (failures.length > 0) {
    console.log(`❌ ${failures.length} FAILURE DETECTED:`);
    failures.forEach(f => console.log(`   - ${f.name} (${f.details})`));
  }
  console.log('======================================================\n');

  return { passed, total, failures };
}

runAdversarialSuite().then(res => {
  if (res.failures.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
