// ====================================================================
// Automated Verification Suite for TataDana Milestone 2 (R2)
// Fitur 'Dompet Baru' Terintegrasi Budget Multi-Periode
// Tests:
// 1. GET /api/state multi-period wallet budget stats
// 2. Multi-period calculations (daily: limit/30, weekly: limit/4, monthly: limit)
// 3. Genuine transaction tracking (expenses mapped to wallet daily/weekly/monthly)
// 4. POST /api/wallets with budget_limit persistence & stats return
// 5. Starter plan 3-wallet restriction (HTTP 403 & upgrade message)
// 6. UI DOM elements for #add-wallet-modal, inputs, preview, and #wallet-upgrade-modal
// 7. Frontend module public/modules/wallet-budget.js logic verification
// ====================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

function get(reqPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${reqPath}`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body
      }));
    }).on('error', reject);
  });
}

function post(reqPath, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload || {});
    const req = http.request(`http://localhost:3000${reqPath}`, {
      method: 'POST',
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
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runM2Tests() {
  console.log('👛 RUNNING MILESTONE 2 (R2) WALLET & MULTI-PERIOD BUDGET VERIFICATION...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
    }
  }

  // Auto-start server if not already running
  try {
    await get('/api/state');
  } catch (e) {
    require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  // 1. Reset state
  try {
    const resetRes = await post('/api/test/reset-state');
    assert(resetRes.status === 200, 'TEST M2-1: Reset state endpoint responds 200');
  } catch (e) {
    assert(false, 'TEST M2-1: Reset state failed: ' + e.message);
  }

  // 2. GET /api/state returns wallets with budget_limit and budget_stats
  try {
    const stateRes = await get('/api/state');
    const state = JSON.parse(stateRes.body);

    assert(stateRes.status === 200, 'TEST M2-2: GET /api/state returns HTTP 200');
    assert(Array.isArray(state.wallets) && state.wallets.length >= 4, 'TEST M2-3: Wallets array populated in state');

    const bca = state.wallets.find(w => w.id === 'wal_bca');
    assert(bca && typeof bca.budget_limit === 'number' && bca.budget_limit > 0, 'TEST M2-4: BCA wallet has numeric budget_limit');
    assert(bca && bca.budget_stats && bca.budget_stats.daily && bca.budget_stats.weekly && bca.budget_stats.monthly, 'TEST M2-5: BCA wallet has multi-period stats (daily, weekly, monthly)');
  } catch (e) {
    assert(false, 'TEST M2-2 - M2-5: ' + e.message);
  }

  // 3. Multi-period calculation formulas verification
  try {
    const { calculateWalletBudgetStats } = require('./src/modules/wallet-budget');
    const mockWallet = { id: 'wal_test_calc', balance: 5000000, budget_limit: 3000000 };
    const mockTx = [
      { id: 'tx_c1', wallet_id: 'wal_test_calc', type: 'expense', amount: 30000, transaction_date: '2026-10-10T10:00:00+07:00' },
      { id: 'tx_c2', wallet_id: 'wal_test_calc', type: 'expense', amount: 150000, transaction_date: '2026-10-08T12:00:00+07:00' },
      { id: 'tx_c3', wallet_id: 'wal_test_calc', type: 'expense', amount: 300000, transaction_date: '2026-10-02T15:00:00+07:00' },
      { id: 'tx_c4', wallet_id: 'wal_other', type: 'expense', amount: 50000, transaction_date: '2026-10-10T10:00:00+07:00' }
    ];

    const stats = calculateWalletBudgetStats(mockWallet, mockTx);

    // Daily limit: 3000000 / 30 = 100000. Daily spent: 30000 (from 2026-10-10). Pct: 30%
    assert(stats.daily.limit === 100000, 'TEST M2-6: Daily limit correctly calculated as budget_limit / 30 (100.000)');
    assert(stats.daily.spent === 30000, 'TEST M2-7: Daily spent correctly filters expenses for wallet on reference date (30.000)');
    assert(stats.daily.percentage === 30, 'TEST M2-8: Daily utilization percentage is 30%');

    // Weekly limit: 3000000 / 4 = 750000. Weekly spent: 30000 + 150000 = 180000 (Oct 8 & 10 are <= 7 days). Pct: 24%
    assert(stats.weekly.limit === 750000, 'TEST M2-9: Weekly limit correctly calculated as budget_limit / 4 (750.000)');
    assert(stats.weekly.spent === 180000, 'TEST M2-10: Weekly spent correctly filters expenses within 7 days (180.000)');
    assert(stats.weekly.percentage === 24, 'TEST M2-11: Weekly utilization percentage is 24%');

    // Monthly limit: 3000000. Monthly spent: 30000 + 150000 + 300000 = 480000. Pct: 16%
    assert(stats.monthly.limit === 3000000, 'TEST M2-12: Monthly limit equals budget_limit (3.000.000)');
    assert(stats.monthly.spent === 480000, 'TEST M2-13: Monthly spent aggregates all month expenses (480.000)');
    assert(stats.monthly.percentage === 16, 'TEST M2-14: Monthly utilization percentage is 16%');
  } catch (e) {
    assert(false, 'TEST M2-6 - M2-14: ' + e.message);
  }

  // 4. POST /api/wallets creates new wallet with budget_limit
  let createdWalletId = null;
  try {
    const payload = {
      name: 'Kantong Operasional Bisnis',
      type: 'bank',
      balance: 4500000,
      budget_limit: 1800000
    };
    const createRes = await post('/api/wallets', payload);

    assert(createRes.status === 200, 'TEST M2-15: POST /api/wallets returns HTTP 200');
    assert(createRes.data.ok === true, 'TEST M2-16: Response contains ok: true');
    assert(createRes.data.wallet && createRes.data.wallet.name === 'Kantong Operasional Bisnis', 'TEST M2-17: Wallet name persisted correctly');
    assert(createRes.data.wallet.budget_limit === 1800000, 'TEST M2-18: budget_limit persisted correctly as 1.800.000');
    assert(createRes.data.budget_stats && createRes.data.budget_stats.daily.limit === 60000, 'TEST M2-19: Response returns multi-period daily limit (1.800.000 / 30 = 60.000)');
    assert(createRes.data.budget_stats && createRes.data.budget_stats.weekly.limit === 450000, 'TEST M2-20: Response returns multi-period weekly limit (1.800.000 / 4 = 450.000)');
    assert(createRes.data.budget_stats && createRes.data.budget_stats.monthly.limit === 1800000, 'TEST M2-21: Response returns monthly limit (1.800.000)');

    createdWalletId = createRes.data.wallet.id;

    // Verify presence in GET /api/state
    const stateRes = await get('/api/state');
    const state = JSON.parse(stateRes.body);
    const found = state.wallets.find(w => w.id === createdWalletId);
    assert(found !== undefined, 'TEST M2-22: Created wallet exists in GET /api/state');
    assert(found && found.budget_limit === 1800000, 'TEST M2-23: Created wallet retains budget_limit in state');
  } catch (e) {
    assert(false, 'TEST M2-15 - M2-23: ' + e.message);
  }

  // 5. Starter plan enforcement (max 3 wallets)
  try {
    // Impersonate Ahmad Fauzi (Starter plan)
    const impRes = await post('/api/admin/impersonate', { userId: 'usr_tatadana_003' });
    assert(impRes.status === 200, 'TEST M2-24: Impersonated Starter user successfully');

    // Attempt to create a 4th wallet when Starter plan has >= 3 wallets
    const rejectRes = await post('/api/wallets', {
      name: 'Dompet Terlarang Starter',
      type: 'ewallet',
      balance: 100000,
      budget_limit: 500000
    });

    assert(rejectRes.status === 403, 'TEST M2-25: Starter plan blocked from exceeding 3 wallets with HTTP 403');
    assert(rejectRes.data.ok === false, 'TEST M2-26: Block response returns ok: false');
    assert(
      rejectRes.data.error && rejectRes.data.error.includes('Batas maksimal 3 dompet'),
      'TEST M2-27: Error message contains Starter 3-wallet restriction message'
    );
    assert(
      rejectRes.data.error && rejectRes.data.error.includes('Upgrade ke Pro'),
      'TEST M2-28: Error message includes Upgrade ke Pro prompt'
    );

    // Switch back to Budi (Pro plan)
    await post('/api/admin/impersonate', { userId: 'usr_tatadana_001' });
  } catch (e) {
    assert(false, 'TEST M2-24 - M2-28: ' + e.message);
  }

  // 6. UI DOM Markup Verification in public/index.html
  try {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    assert(htmlContent.includes('id="add-wallet-modal"'), 'TEST M2-29: public/index.html contains #add-wallet-modal dialog');
    assert(htmlContent.includes('id="new-wallet-name"'), 'TEST M2-30: Modal contains #new-wallet-name input');
    assert(htmlContent.includes('id="new-wallet-type"'), 'TEST M2-31: Modal contains #new-wallet-type select');
    assert(htmlContent.includes('id="new-wallet-balance"'), 'TEST M2-32: Modal contains #new-wallet-balance input');
    assert(htmlContent.includes('id="new-wallet-budget"'), 'TEST M2-33: Modal contains #new-wallet-budget input');
    assert(htmlContent.includes('id="preview-daily-limit"'), 'TEST M2-34: Modal contains #preview-daily-limit element');
    assert(htmlContent.includes('id="preview-weekly-limit"'), 'TEST M2-35: Modal contains #preview-weekly-limit element');
    assert(htmlContent.includes('id="preview-monthly-limit"'), 'TEST M2-36: Modal contains #preview-monthly-limit element');
    assert(htmlContent.includes('id="wallet-upgrade-modal"'), 'TEST M2-37: public/index.html contains #wallet-upgrade-modal');
    assert(htmlContent.includes('/modules/wallet-budget.js'), 'TEST M2-38: public/index.html imports /modules/wallet-budget.js');
    assert(htmlContent.includes('openAddWalletModal()'), 'TEST M2-39: Dashboard button triggers openAddWalletModal()');
  } catch (e) {
    assert(false, 'TEST M2-29 - M2-39: ' + e.message);
  }

  // 7. Frontend Module public/modules/wallet-budget.js Verification
  try {
    const jsPath = path.join(__dirname, 'public', 'modules', 'wallet-budget.js');
    assert(fs.existsSync(jsPath), 'TEST M2-40: public/modules/wallet-budget.js exists on disk');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    assert(jsContent.includes('openAddWalletModal'), 'TEST M2-41: Frontend module defines openAddWalletModal');
    assert(jsContent.includes('closeAddWalletModal'), 'TEST M2-42: Frontend module defines closeAddWalletModal');
    assert(jsContent.includes('updateMultiPeriodPreview'), 'TEST M2-43: Frontend module defines updateMultiPeriodPreview');
    assert(jsContent.includes('handleCreateWalletSubmit'), 'TEST M2-44: Frontend module defines handleCreateWalletSubmit');
    assert(jsContent.includes('renderWalletCardsWithBudget'), 'TEST M2-45: Frontend module defines renderWalletCardsWithBudget');
    assert(jsContent.includes('openWalletUpgradeModal'), 'TEST M2-46: Frontend module defines openWalletUpgradeModal');
    assert(jsContent.includes('calculateClientWalletBudget'), 'TEST M2-47: Frontend module defines calculateClientWalletBudget');
  } catch (e) {
    assert(false, 'TEST M2-40 - M2-47: ' + e.message);
  }

  // 8. Clean up: reset state
  try {
    await post('/api/test/reset-state');
    assert(true, 'TEST M2-48: Final state reset completed');
  } catch (e) {
    assert(false, 'TEST M2-48: ' + e.message);
  }

  console.log(`\n======================================================`);
  console.log(`📊 M2 VERIFICATION RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runM2Tests().catch(err => {
  console.error('Fatal M2 test runner error:', err);
  process.exit(1);
});
