// ====================================================================
// Automated Verification Suite for TataDana:
// Conditional Form "Tambah Dompet" (Bank & E-Wallet Dropdowns)
// and Database Persistence of institution_name
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

async function runWalletConditionalTests() {
  console.log('🏦 RUNNING CONDITIONAL "TAMBAH DOMPET" & INSTITUTION_NAME VERIFICATION...\n');
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

  // 1. Reset state
  try {
    const resetRes = await post('/api/test/reset-state');
    assert(resetRes.status === 200, 'TEST WCI-1: Reset state endpoint responds 200');
  } catch (e) {
    assert(false, 'TEST WCI-1: Reset state failed: ' + e.message);
  }

  // 2. Switch/ensure Pro User
  try {
    const impRes = await post('/api/admin/impersonate', { userId: 'usr_tatadana_001' });
    assert(impRes.status === 200, 'TEST WCI-2: Impersonated Pro user (Budi Pratama)');
  } catch (e) {
    assert(false, 'TEST WCI-2: Failed to impersonate Pro user: ' + e.message);
  }

  // 3. Verify HTML DOM markup in public/index.html
  try {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert(html.includes('id="new-wallet-type"'), 'TEST WCI-3: index.html contains #new-wallet-type');
    assert(html.includes('onchange="handleWalletTypeChange(this.value)"'), 'TEST WCI-4: #new-wallet-type triggers handleWalletTypeChange(this.value)');

    // Bank container and options: BRI, BCA, Mandiri, BNI, BSI
    assert(html.includes('id="wallet-bank-container"'), 'TEST WCI-5: index.html contains #wallet-bank-container');
    assert(html.includes('id="new-wallet-bank"'), 'TEST WCI-6: index.html contains #new-wallet-bank select');
    assert(html.includes('value="BRI"') && html.includes('value="BCA"') && html.includes('value="Mandiri"') && html.includes('value="BNI"') && html.includes('value="BSI"'),
      'TEST WCI-7: Bank select contains exact options: BRI, BCA, Mandiri, BNI, BSI');

    // E-Wallet container and options: DANA, GoPay, ShopeePay, OVO
    assert(html.includes('id="wallet-ewallet-container"'), 'TEST WCI-8: index.html contains #wallet-ewallet-container');
    assert(html.includes('id="new-wallet-ewallet"'), 'TEST WCI-9: index.html contains #new-wallet-ewallet select');
    assert(html.includes('value="DANA"') && html.includes('value="GoPay"') && html.includes('value="ShopeePay"') && html.includes('value="OVO"'),
      'TEST WCI-10: E-Wallet select contains exact options: DANA, GoPay, ShopeePay, OVO');
  } catch (e) {
    assert(false, 'TEST WCI-3 - WCI-10: ' + e.message);
  }

  // 4. Verify Frontend logic in public/modules/wallet-budget.js
  try {
    const jsPath = path.join(__dirname, 'public', 'modules', 'wallet-budget.js');
    const js = fs.readFileSync(jsPath, 'utf8');

    assert(js.includes('function handleWalletTypeChange'), 'TEST WCI-11: wallet-budget.js defines handleWalletTypeChange');
    assert(js.includes('window.handleWalletTypeChange = handleWalletTypeChange'), 'TEST WCI-12: handleWalletTypeChange is exported to window');
    assert(js.includes('new-wallet-bank') && js.includes('new-wallet-ewallet'), 'TEST WCI-13: handleCreateWalletSubmit extracts bank or ewallet value');
    assert(js.includes('institution_name'), 'TEST WCI-14: handleCreateWalletSubmit sends institution_name in payload');
    assert(js.includes('w.institution_name'), 'TEST WCI-15: renderWalletCardsWithBudget references w.institution_name for display badge');
  } catch (e) {
    assert(false, 'TEST WCI-11 - WCI-15: ' + e.message);
  }

  // 5. Verify Database migrations
  try {
    const migPath = path.join(__dirname, 'supabase', 'migrations', '003_add_wallet_institution.sql');
    assert(fs.existsSync(migPath), 'TEST WCI-16: supabase/migrations/003_add_wallet_institution.sql exists');
    const migSql = fs.readFileSync(migPath, 'utf8');
    assert(migSql.includes('institution_name TEXT'), 'TEST WCI-17: Migration adds institution_name TEXT to wallets table');

    const initSchema = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '001_initial_schema.sql'), 'utf8');
    assert(initSchema.includes('institution_name TEXT'), 'TEST WCI-18: 001_initial_schema.sql includes institution_name TEXT');
  } catch (e) {
    assert(false, 'TEST WCI-16 - WCI-18: ' + e.message);
  }

  // 6. Test Backend API: Create Bank Wallet with explicit institution_name
  let briWalletId = '';
  try {
    const res = await post('/api/wallets', {
      name: 'Rekening Usaha BRI',
      type: 'bank',
      institution_name: 'BRI',
      balance: 1500000,
      budget_limit: 3000000
    });

    assert(res.status === 200 || res.status === 201, 'TEST WCI-19: Create bank wallet responds HTTP 200/201');
    assert(res.data.ok === true, 'TEST WCI-20: Create bank wallet response ok: true');
    assert(res.data.wallet && res.data.wallet.institution_name === 'BRI', 'TEST WCI-21: Wallet institution_name is BRI in response');
    assert(res.data.wallet && res.data.wallet.bank_name === 'BRI', 'TEST WCI-22: Wallet bank_name alias is BRI');
    briWalletId = res.data.wallet ? res.data.wallet.id : '';
  } catch (e) {
    assert(false, 'TEST WCI-19 - WCI-22: ' + e.message);
  }

  // 7. Test Backend API: Create E-Wallet with explicit institution_name
  let gopayWalletId = '';
  try {
    const res = await post('/api/wallets', {
      name: 'Kantong GoPay Harian',
      type: 'ewallet',
      institution_name: 'GoPay',
      balance: 350000,
      budget_limit: 1000000
    });

    assert(res.status === 200 || res.status === 201, 'TEST WCI-23: Create e-wallet responds HTTP 200/201');
    assert(res.data.ok === true, 'TEST WCI-24: Create e-wallet response ok: true');
    assert(res.data.wallet && res.data.wallet.institution_name === 'GoPay', 'TEST WCI-25: Wallet institution_name is GoPay in response');
    assert(res.data.wallet && res.data.wallet.provider_name === 'GoPay', 'TEST WCI-26: Wallet provider_name alias is GoPay');
    gopayWalletId = res.data.wallet ? res.data.wallet.id : '';
  } catch (e) {
    assert(false, 'TEST WCI-23 - WCI-26: ' + e.message);
  }

  // 8. Test Backend API: Create Cash Wallet (institution_name null)
  let cashWalletId = '';
  try {
    const res = await post('/api/wallets', {
      name: 'Dompet Kulit Cokelat',
      type: 'cash',
      balance: 200000,
      budget_limit: 500000
    });

    assert(res.status === 200 || res.status === 201, 'TEST WCI-27: Create cash wallet responds HTTP 200/201');
    assert(res.data.wallet && (res.data.wallet.institution_name === null || res.data.wallet.institution_name === undefined),
      'TEST WCI-28: Cash wallet institution_name is null/undefined');
    cashWalletId = res.data.wallet ? res.data.wallet.id : '';
  } catch (e) {
    assert(false, 'TEST WCI-27 - WCI-28: ' + e.message);
  }

  // 9. Verify Persistence in GET /api/state
  try {
    const stateRes = await get('/api/state');
    assert(stateRes.status === 200, 'TEST WCI-29: GET /api/state responds HTTP 200');
    const state = JSON.parse(stateRes.body);

    const bri = state.wallets.find(w => w.id === briWalletId);
    assert(bri && bri.institution_name === 'BRI', 'TEST WCI-30: BRI wallet preserved in state with institution_name BRI');

    const gopay = state.wallets.find(w => w.id === gopayWalletId);
    assert(gopay && gopay.institution_name === 'GoPay', 'TEST WCI-31: GoPay wallet preserved in state with institution_name GoPay');

    const cash = state.wallets.find(w => w.id === cashWalletId);
    assert(cash && !cash.institution_name, 'TEST WCI-32: Cash wallet preserved with null/empty institution_name');
  } catch (e) {
    assert(false, 'TEST WCI-29 - WCI-32: ' + e.message);
  }

  // 10. Test Fallback detection if institution_name omitted but name matches
  try {
    const bsiRes = await post('/api/wallets', {
      name: 'Giro Bisnis BSI Syariah',
      type: 'bank',
      balance: 500000,
      budget_limit: 1000000
    });
    assert((bsiRes.status === 200 || bsiRes.status === 201) && bsiRes.data.wallet.institution_name === 'BSI',
      'TEST WCI-33: Auto-detects BSI institution_name from wallet name');

    const ovoRes = await post('/api/wallets', {
      name: 'Saldo OVO Cash',
      type: 'ewallet',
      balance: 100000,
      budget_limit: 500000
    });
    assert((ovoRes.status === 200 || ovoRes.status === 201) && ovoRes.data.wallet.institution_name === 'OVO',
      'TEST WCI-34: Auto-detects OVO institution_name from wallet name');
  } catch (e) {
    assert(false, 'TEST WCI-33 - WCI-34: ' + e.message);
  }

  // 11. Final cleanup
  try {
    await post('/api/test/reset-state');
    assert(true, 'TEST WCI-35: Final state reset completed cleanly');
  } catch (e) {
    assert(false, 'TEST WCI-35: ' + e.message);
  }

  console.log(`\n======================================================`);
  console.log(`📊 CONDITIONAL WALLET RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runWalletConditionalTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
