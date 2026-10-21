// ====================================================================
// Automated Verification Suite for TataDana:
// In-App 'Tata AI' Multi-Turn Expense Flow with Wallet Selection
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

async function runTataAiWalletFlowTests() {
  console.log('🤖 RUNNING TATA AI MULTI-TURN WALLET FLOW VERIFICATION...\n');
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
    assert(resetRes.status === 200, 'TEST AI-1: Reset state endpoint responds 200');
  } catch (e) {
    assert(false, 'TEST AI-1: Reset state failed: ' + e.message);
  }

  // 2. Unit functions exported by src/modules/tata-ai.js
  try {
    const tataAi = require('./src/modules/tata-ai');
    assert(typeof tataAi.handleTataAiChat === 'function', 'TEST AI-2: handleTataAiChat is exported');
    assert(typeof tataAi.extractExpenseDetails === 'function', 'TEST AI-3: extractExpenseDetails is exported');
    assert(typeof tataAi.formatWalletOptionsText === 'function', 'TEST AI-4: formatWalletOptionsText is exported');
    assert(typeof tataAi.findWalletByUserInput === 'function', 'TEST AI-5: findWalletByUserInput is exported');

    // Unit test formatWalletOptionsText with exact prompt example (Cash, BCA, DANA)
    const mockWallets = [
      { id: 'w1', name: 'Cash', type: 'cash' },
      { id: 'w2', name: 'BCA Utama', institution_name: 'BCA', type: 'bank' },
      { id: 'w3', name: 'DANA Digital', institution_name: 'DANA', type: 'ewallet' }
    ];
    const formatted = tataAi.formatWalletOptionsText(mockWallets);
    assert(formatted === 'Cash, BCA, atau DANA', 'TEST AI-6: formatWalletOptionsText formats "Cash, BCA, atau DANA" accurately');

    // Unit test extractExpenseDetails
    const details = tataAi.extractExpenseDetails('makan 20rb', { categories: [{ id: 'cat_makanan', name: 'Makanan & Minuman' }] });
    assert(details.nominal === 20000, 'TEST AI-7: extractExpenseDetails parses nominal 20000');
    assert(details.categoryName === 'Makanan & Minuman', 'TEST AI-8: extractExpenseDetails categorizes as Makanan & Minuman');
    assert(details.categoryId === 'cat_makanan', 'TEST AI-9: extractExpenseDetails matches categoryId cat_makanan');

    // Unit test findWalletByUserInput
    const foundBca = tataAi.findWalletByUserInput('pakai BCA', mockWallets);
    assert(foundBca && foundBca.id === 'w2', 'TEST AI-10: findWalletByUserInput matches "pakai BCA" to w2');
    const foundCash = tataAi.findWalletByUserInput('dompet cash', mockWallets);
    assert(foundCash && foundCash.id === 'w1', 'TEST AI-11: findWalletByUserInput matches "dompet cash" to w1');
    const foundDana = tataAi.findWalletByUserInput('👛 DANA', mockWallets);
    assert(foundDana && foundDana.id === 'w3', 'TEST AI-12: findWalletByUserInput matches "👛 DANA" to w3');
  } catch (e) {
    assert(false, 'TEST AI-2 - AI-12 failed: ' + e.message);
  }

  // 3. Step 1: User types expense "makan 20rb" via API POST /api/ai/chat
  let txCountBefore = 0;
  let bcaBalBefore = 0;
  try {
    const stateBefore = JSON.parse((await get('/api/state')).body);
    txCountBefore = stateBefore.transactions.length;
    const bcaWallet = stateBefore.wallets.find(w => w.id === 'wal_bca');
    bcaBalBefore = bcaWallet.balance;

    const resStep1 = await post('/api/ai/chat', {
      message: 'makan 20rb',
      history: []
    });

    assert(resStep1.status === 200, 'TEST AI-13: POST /api/ai/chat responds HTTP 200 for "makan 20rb"');
    assert(resStep1.data.ok === true, 'TEST AI-14: Response ok: true');
    assert(resStep1.data.reply.includes('Transaksi ini pakai dompet yang mana?'),
      'TEST AI-15: Reply contains mandatory question "Transaksi ini pakai dompet yang mana?"');
    assert(resStep1.data.reply.includes('Rp20.000'), 'TEST AI-16: Reply mentions nominal Rp20.000');
    assert(resStep1.data.pending_transaction !== null && resStep1.data.pending_transaction.amount === 20000,
      'TEST AI-17: Response includes pending_transaction with amount 20000');

    // CRUCIAL: Transaction MUST NOT be saved to database yet!
    const stateMid = JSON.parse((await get('/api/state')).body);
    assert(stateMid.transactions.length === txCountBefore,
      'TEST AI-18: STRICT CHECK - Transaction is NOT saved to database before wallet is chosen');
    const bcaMid = stateMid.wallets.find(w => w.id === 'wal_bca');
    assert(bcaMid.balance === bcaBalBefore,
      'TEST AI-19: STRICT CHECK - Wallet balance remains unchanged before wallet selection');
  } catch (e) {
    assert(false, 'TEST AI-13 - AI-19 failed: ' + e.message);
  }

  // 4. Step 2: User replies with wallet name "BCA"
  try {
    const resStep2 = await post('/api/ai/chat', {
      message: 'BCA',
      history: [
        { role: 'user', content: 'makan 20rb' },
        { role: 'assistant', content: 'Transaksi ini pakai dompet yang mana?' }
      ]
    });

    assert(resStep2.status === 200, 'TEST AI-20: POST /api/ai/chat responds HTTP 200 for wallet selection "BCA"');
    assert(resStep2.data.ok === true, 'TEST AI-21: Step 2 response ok: true');
    assert(resStep2.data.reply.includes('Pengeluaran berhasil dicatat ke database'),
      'TEST AI-22: Reply confirms transaction successfully recorded to database');
    assert(resStep2.data.reply.includes('BCA'), 'TEST AI-23: Reply confirms BCA wallet');
    assert(resStep2.data.transaction && resStep2.data.transaction.amount === 20000,
      'TEST AI-24: Step 2 returns created transaction object');
    assert(resStep2.data.pending_transaction === null,
      'TEST AI-25: Step 2 clears pending_transaction');

    // CRUCIAL: Now verify database persistence in GET /api/state
    const stateAfter = JSON.parse((await get('/api/state')).body);
    assert(stateAfter.transactions.length === txCountBefore + 1,
      'TEST AI-26: Database transactions table now has exactly +1 transaction');
    const savedTx = stateAfter.transactions[0];
    assert(savedTx.amount === 20000 && savedTx.wallet_id === 'wal_bca' && savedTx.source === 'tata_ai',
      'TEST AI-27: Saved transaction has amount 20000, wallet_id wal_bca, source tata_ai');

    const bcaAfter = stateAfter.wallets.find(w => w.id === 'wal_bca');
    assert(bcaAfter.balance === bcaBalBefore - 20000,
      'TEST AI-28: BCA wallet balance reduced by exactly 20000');
  } catch (e) {
    assert(false, 'TEST AI-20 - AI-28 failed: ' + e.message);
  }

  // 5. Test another expense: "beli bensin 50rb" with "Cash"
  try {
    const stateBeforeGas = JSON.parse((await get('/api/state')).body);
    const countBeforeGas = stateBeforeGas.transactions.length;
    const cashBefore = stateBeforeGas.wallets.find(w => w.id === 'wal_cash').balance;

    const gasRes1 = await post('/api/ai/chat', { message: 'beli bensin 50rb' });
    assert(gasRes1.data.reply.includes('Transaksi ini pakai dompet yang mana?'),
      'TEST AI-29: "beli bensin 50rb" asks for wallet source');

    const gasRes2 = await post('/api/ai/chat', { message: 'pakai Cash' });
    assert(gasRes2.data.reply.includes('Pengeluaran berhasil dicatat ke database'),
      'TEST AI-30: "pakai Cash" saves expense to database');

    const stateAfterGas = JSON.parse((await get('/api/state')).body);
    assert(stateAfterGas.transactions.length === countBeforeGas + 1,
      'TEST AI-31: Gas transaction added to database');
    const cashAfter = stateAfterGas.wallets.find(w => w.id === 'wal_cash').balance;
    assert(cashAfter === cashBefore - 50000,
      'TEST AI-32: Cash wallet balance reduced by 50000');
  } catch (e) {
    assert(false, 'TEST AI-29 - AI-32 failed: ' + e.message);
  }

  // 6. Test cancellation: User starts expense then cancels
  try {
    const countBeforeCancel = JSON.parse((await get('/api/state')).body).transactions.length;
    await post('/api/ai/chat', { message: 'kopi latte 40rb' });
    const cancelRes = await post('/api/ai/chat', { message: 'batal' });

    assert(cancelRes.data.ok === true && cancelRes.data.reply.includes('dibatalkan'),
      'TEST AI-33: Answering "batal" cancels the transaction');
    assert(cancelRes.data.pending_transaction === null,
      'TEST AI-34: Cancellation clears pending transaction');

    const countAfterCancel = JSON.parse((await get('/api/state')).body).transactions.length;
    assert(countAfterCancel === countBeforeCancel,
      'TEST AI-35: Cancelled transaction is NOT added to database');
  } catch (e) {
    assert(false, 'TEST AI-33 - AI-35 failed: ' + e.message);
  }

  // 7. Test unknown wallet clarification
  try {
    await post('/api/ai/chat', { message: 'jajan donat 15rb' });
    const unknownRes = await post('/api/ai/chat', { message: 'dompet luar angkasa' });

    assert(unknownRes.data.reply.includes('tidak ditemukan') && unknownRes.data.reply.includes('Transaksi ini pakai dompet yang mana?'),
      'TEST AI-36: Unknown wallet prompt asks again politely with wallet options');
    assert(unknownRes.data.pending_transaction && unknownRes.data.pending_transaction.amount === 15000,
      'TEST AI-37: Pending transaction is retained when unknown wallet is entered');

    // Clean up with cancel
    await post('/api/ai/chat', { message: 'batal' });
  } catch (e) {
    assert(false, 'TEST AI-36 - AI-37 failed: ' + e.message);
  }

  // 8. Verify client script public/modules/tata-ai.js
  try {
    const clientJsPath = path.join(__dirname, 'public', 'modules', 'tata-ai.js');
    const clientJs = fs.readFileSync(clientJsPath, 'utf8');

    assert(clientJs.includes('pendingTransaction'), 'TEST AI-38: Client script tracks pendingTransaction state');
    assert(clientJs.includes('pending_transaction'), 'TEST AI-39: Client script transmits pending_transaction in request');
    assert(clientJs.includes('window.loadState'), 'TEST AI-40: Client script invokes window.loadState upon transaction recording');
  } catch (e) {
    assert(false, 'TEST AI-38 - AI-40 failed: ' + e.message);
  }

  // 9. Reset state cleanup
  try {
    await post('/api/test/reset-state');
    assert(true, 'TEST AI-41: Final state reset completed');
  } catch (e) {
    assert(false, 'TEST AI-41 failed: ' + e.message);
  }

  console.log(`\n======================================================`);
  console.log(`📊 TATA AI RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTataAiWalletFlowTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
