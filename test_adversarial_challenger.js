// ====================================================================
// TataDana Fintech SaaS: Empirical Challenger Adversarial Test Suite
// Rigorous verification of Indonesian Currency NLP, Webhook Idempotency,
// and Admin Approval State Machine.
// ====================================================================

const http = require('http');
const assert = require('assert');
const telegramNlp = require('./src/lib/telegram-nlp');
const adminApproval = require('./src/modules/admin-approval');

let runningServer = null;
let testUpdateId = 880000;
function nextUid() {
  testUpdateId += 1;
  return testUpdateId;
}

function post(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data || {});
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch (e) { parsed = { raw: body }; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch (e) { parsed = { raw: body }; }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed, body });
      });
    }).on('error', reject);
  });
}

async function runAdversarialSuite() {
  console.log('⚔️  STARTING EMPIRICAL CHALLENGER ADVERSARIAL STRESS TEST SUITE...\n');
  let passed = 0;
  let total = 0;
  const failures = [];

  function challenge(cond, name, details = '') {
    total++;
    if (cond) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${details ? '— ' + details : ''}`);
      failures.push({ name, details });
    }
  }

  // Ensure server is reachable
  try {
    await get('/api/state');
  } catch (e) {
    runningServer = require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  // ==================================================================
  // PART 1: INDONESIAN CURRENCY NLP & INCOME INVERSION ADVERSARIAL TESTS
  // ==================================================================
  console.log('\n--- [CHALLENGE 1] INDONESIAN CURRENCY NLP & INCOME INVERSION ---');

  // Case 1.1: "beli 3 paket data 150rb"
  const c1 = telegramNlp.categorizeTelegramMessage('beli 3 paket data 150rb');
  challenge(
    c1.nominal === 150000,
    'Tricky Currency: "beli 3 paket data 150rb" extracts 150000 (quantity 3 does NOT corrupt nominal)',
    `got nominal: ${c1.nominal}`
  );
  challenge(
    c1.type === 'expense',
    'Tricky Currency: "beli 3 paket data 150rb" classified as EXPENSE',
    `got type: ${c1.type}`
  );
  challenge(
    c1.categoryName === 'Tagihan & Utilitas',
    'Tricky Currency: "beli 3 paket data 150rb" categorised as Tagihan & Utilitas',
    `got category: ${c1.categoryName}`
  );

  // Case 1.2: "gaji supir 2,5 jt"
  const c2 = telegramNlp.categorizeTelegramMessage('gaji supir 2,5 jt');
  challenge(
    c2.nominal === 2500000,
    'Tricky Currency: "gaji supir 2,5 jt" extracts 2500000',
    `got nominal: ${c2.nominal}`
  );
  challenge(
    c2.type === 'expense',
    'Income Inversion: "gaji supir 2,5 jt" classified as EXPENSE (NOT income)',
    `got type: ${c2.type}`
  );
  challenge(
    c2.categoryName === 'Tagihan & Utilitas',
    'Categorization: "gaji supir 2,5 jt" mapped to Tagihan & Utilitas',
    `got category: ${c2.categoryName}`
  );

  // Case 1.3: "bayar gaji pembantu 1.250.000"
  const c3 = telegramNlp.categorizeTelegramMessage('bayar gaji pembantu 1.250.000');
  challenge(
    c3.nominal === 1250000,
    'Tricky Currency: "bayar gaji pembantu 1.250.000" extracts 1250000',
    `got nominal: ${c3.nominal}`
  );
  challenge(
    c3.type === 'expense',
    'Income Inversion: "bayar gaji pembantu 1.250.000" classified as EXPENSE',
    `got type: ${c3.type}`
  );

  // Case 1.4: "50k"
  const c4 = telegramNlp.parseIndonesianCurrency('50k');
  challenge(c4 === 50000, 'Tricky Currency: "50k" parses as 50000', `got: ${c4}`);

  // Case 1.5: "100 perak"
  const c5 = telegramNlp.parseIndonesianCurrency('100 perak');
  challenge(c5 === 100, 'Tricky Currency: "100 perak" parses as 100', `got: ${c5}`);

  // Case 1.6: "1.5 juta"
  const c6 = telegramNlp.parseIndonesianCurrency('1.5 juta');
  challenge(c6 === 1500000, 'Tricky Currency: "1.5 juta" parses as 1500000', `got: ${c6}`);

  // Case 1.7: "2 ayam 35.000"
  const c7 = telegramNlp.categorizeTelegramMessage('2 ayam 35.000');
  challenge(
    c7.nominal === 35000,
    'Tricky Currency: "2 ayam 35.000" extracts 35000 (quantity 2 does NOT corrupt nominal to 235000)',
    `got: ${c7.nominal}`
  );
  challenge(
    c7.type === 'expense' && c7.categoryName === 'Makanan & Minuman',
    'Categorization: "2 ayam 35.000" mapped to Makanan & Minuman expense',
    `got type: ${c7.type}, cat: ${c7.categoryName}`
  );

  // Additional Tricky Strings
  // 1.8: Two-digit quantity "beli 10 mangga 50rb"
  const c8 = telegramNlp.parseIndonesianCurrency('beli 10 mangga 50rb');
  challenge(c8 === 50000, 'Adversarial: "beli 10 mangga 50rb" extracts 50000 without corruption', `got: ${c8}`);

  // 1.9: "3 kopi susu 75k"
  const c9 = telegramNlp.parseIndonesianCurrency('3 kopi susu 75k');
  challenge(c9 === 75000, 'Adversarial: "3 kopi susu 75k" extracts 75000', `got: ${c9}`);

  // 1.10: "order 5 porsi sate 125.000"
  const c10 = telegramNlp.parseIndonesianCurrency('order 5 porsi sate 125.000');
  challenge(c10 === 125000, 'Adversarial: "order 5 porsi sate 125.000" extracts 125000', `got: ${c10}`);

  // 1.11: "bayar upah tukang 350.000"
  const c11 = telegramNlp.categorizeTelegramMessage('bayar upah tukang 350.000');
  challenge(c11.nominal === 350000 && c11.type === 'expense', 'Income Inversion: "bayar upah tukang 350.000" is expense with 350000');

  // 1.12: "transfer honor narasumber 2,5jt"
  const c12 = telegramNlp.categorizeTelegramMessage('transfer honor narasumber 2,5jt');
  challenge(c12.nominal === 2500000 && c12.type === 'expense', 'Income Inversion: "transfer honor narasumber 2,5jt" is expense with 2500000');

  // 1.13: "gajian 10jt" (User income)
  const c13 = telegramNlp.categorizeTelegramMessage('gajian 10jt');
  challenge(c13.nominal === 10000000 && c13.type === 'income', 'User Income: "gajian 10jt" is correctly classified as INCOME with 10000000');

  // 1.14: "bonus kantor 5jt" (User income)
  const c14 = telegramNlp.categorizeTelegramMessage('bonus kantor 5jt');
  challenge(c14.nominal === 5000000 && c14.type === 'income', 'User Income: "bonus kantor 5jt" is correctly classified as INCOME with 5000000');

  // 1.15: "gaji 15jt" (User salary received)
  const c15 = telegramNlp.categorizeTelegramMessage('gaji 15jt');
  challenge(c15.nominal === 15000000 && c15.type === 'income', 'User Income: "gaji 15jt" is INCOME with 15000000');

  // 1.16: "beli 4 ban mobil 2.400.000"
  const c16 = telegramNlp.categorizeTelegramMessage('beli 4 ban mobil 2.400.000');
  challenge(c16.nominal === 2400000 && c16.type === 'expense', 'Tricky Currency: "beli 4 ban mobil 2.400.000" nominal 2400000 expense');

  // 1.17: "beli 2 ayam geprek 25000" (plain number)
  const c17 = telegramNlp.parseIndonesianCurrency('beli 2 ayam geprek 25000');
  challenge(c17 === 25000, 'Plain digits: "beli 2 ayam geprek 25000" extracts 25000 (NOT 225000)', `got: ${c17}`);

  // 1.18: "gaji supir 2.5 jt" (dot variant)
  const c18 = telegramNlp.categorizeTelegramMessage('gaji supir 2.5 jt');
  challenge(c18.nominal === 2500000 && c18.type === 'expense', 'Income Inversion: "gaji supir 2.5 jt" is expense with 2500000');

  // 1.19: "gaji pembantu 1.25jt"
  const c19 = telegramNlp.categorizeTelegramMessage('gaji pembantu 1.25jt');
  challenge(c19.nominal === 1250000 && c19.type === 'expense', 'Income Inversion: "gaji pembantu 1.25jt" is expense with 1250000');

  // 1.20: "gaji karyawan 4,5jt"
  const c20 = telegramNlp.categorizeTelegramMessage('gaji karyawan 4,5jt');
  challenge(c20.nominal === 4500000 && c20.type === 'expense', 'Income Inversion: "gaji karyawan 4,5jt" is expense with 4500000');

  // 1.21: Anti-misclassification fallback to Lain-lain
  const c21 = telegramNlp.categorizeTelegramMessage('potong rambut 45rb');
  challenge(c21.categoryName === 'Lain-lain', 'Anti-misclassification: "potong rambut 45rb" is Lain-lain, NOT Makanan & Minuman');

  // 1.22: Non-nominal text
  const c22 = telegramNlp.parseIndonesianCurrency('bukan angka sama sekali');
  challenge(c22 === null, 'Non-currency string returns null');

  // ==================================================================
  // PART 2: WEBHOOK IDEMPOTENCY & BALANCE INTEGRITY STRESS TESTS
  // ==================================================================
  console.log('\n--- [CHALLENGE 2] WEBHOOK IDEMPOTENCY & BALANCE INTEGRITY ---');

  // Reset database state before webhook tests
  await post('/api/test/reset-state');

  // Get initial state
  const stateRes1 = await get('/api/state');
  const initialWallets = stateRes1.data.wallets;
  const initialDefaultWallet = initialWallets.find(w => w.is_default && w.is_active) || initialWallets[0];
  const initialBalance = initialDefaultWallet.balance;
  const initialTxCount = stateRes1.data.transactions.length;

  console.log(`Initial Default Wallet (${initialDefaultWallet.name}) Balance: Rp ${initialBalance.toLocaleString('id-ID')}`);
  console.log(`Initial Transaction Count: ${initialTxCount}`);

  // Test 2.1: First Webhook Call with explicit update_id
  const uid1 = nextUid();
  const wh1 = await post('/api/telegram/webhook', {
    update_id: uid1,
    message: { text: 'beli bensin motor 30rb' }
  });
  challenge(
    wh1.status === 200 && wh1.data.transaction && wh1.data.transaction.amount === 30000,
    'Webhook 1st call: "beli bensin motor 30rb" processed successfully with HTTP 200'
  );

  // Check state after 1st call
  const stateRes2 = await get('/api/state');
  const postWh1Wallet = stateRes2.data.wallets.find(w => w.id === initialDefaultWallet.id);
  const postWh1TxCount = stateRes2.data.transactions.length;
  challenge(
    postWh1Wallet.balance === initialBalance - 30000,
    `Balance Decrement: Wallet balance decreased by exactly 30.000 (${initialBalance} -> ${postWh1Wallet.balance})`,
    `expected ${initialBalance - 30000}, got ${postWh1Wallet.balance}`
  );
  challenge(
    postWh1TxCount === initialTxCount + 1,
    `Transaction Count: Transactions increased by exactly 1 (${initialTxCount} -> ${postWh1TxCount})`
  );

  // Test 2.2: Duplicate call with exact same update_id within 60s
  const wh1Dup = await post('/api/telegram/webhook', {
    update_id: uid1,
    message: { text: 'beli bensin motor 30rb' }
  });
  challenge(
    wh1Dup.status === 200 && wh1Dup.data.skipped_reason === 'idempotent_duplicate',
    'Webhook Idempotency: exact duplicate update_id returns skipped_reason="idempotent_duplicate"'
  );

  // Verify balance and transactions DID NOT CHANGE
  const stateRes3 = await get('/api/state');
  const postDupWallet = stateRes3.data.wallets.find(w => w.id === initialDefaultWallet.id);
  const postDupTxCount = stateRes3.data.transactions.length;
  challenge(
    postDupWallet.balance === postWh1Wallet.balance,
    `Balance Protection: Wallet balance strictly unchanged after duplicate update_id (${postDupWallet.balance} === ${postWh1Wallet.balance})`,
    `expected ${postWh1Wallet.balance}, got ${postDupWallet.balance}`
  );
  challenge(
    postDupTxCount === postWh1TxCount,
    `Transaction Protection: Transaction count unchanged after duplicate update_id (${postDupTxCount} === ${postWh1TxCount})`
  );

  // Test 2.3: Semantic Duplicate Protection (different update_id, same text within 60s)
  const uidSemantic = nextUid();
  const whSemDup = await post('/api/telegram/webhook', {
    update_id: uidSemantic,
    message: { text: 'beli bensin motor 30rb' }
  });
  challenge(
    whSemDup.status === 200 && whSemDup.data.skipped_reason === 'idempotent_duplicate',
    'Semantic Deduplication: Same text within 60s with different update_id blocked as idempotent_duplicate'
  );

  // Verify balance still unchanged
  const stateRes4 = await get('/api/state');
  const postSemWallet = stateRes4.data.wallets.find(w => w.id === initialDefaultWallet.id);
  challenge(
    postSemWallet.balance === postWh1Wallet.balance,
    `Balance Protection: Wallet balance strictly unchanged after semantic duplicate within 60s`
  );

  // Test 2.4: Missing update_id (null/undefined) first call
  const whNoUid1 = await post('/api/telegram/webhook', {
    message: { text: 'Beli galon air mineral 20rb' }
  });
  challenge(
    whNoUid1.status === 200 && whNoUid1.data.transaction && whNoUid1.data.transaction.amount === 20000,
    'Missing update_id: First call without update_id accepted and processed with HTTP 200'
  );

  const stateRes5 = await get('/api/state');
  const postNoUid1Wallet = stateRes5.data.wallets.find(w => w.id === initialDefaultWallet.id);
  const postNoUid1TxCount = stateRes5.data.transactions.length;
  challenge(
    postNoUid1Wallet.balance === postWh1Wallet.balance - 20000,
    `Balance Decrement: Wallet balance decreased by 20.000 for missing update_id first call`
  );

  // Test 2.5: Missing update_id duplicate call within 60s (cannot bypass idempotency)
  const whNoUid2 = await post('/api/telegram/webhook', {
    message: { text: 'Beli galon air mineral 20rb' }
  });
  challenge(
    whNoUid2.status === 200 && whNoUid2.data.skipped_reason === 'idempotent_duplicate',
    'Missing update_id: Duplicate call without update_id blocked (no idempotency bypass)'
  );

  const stateRes6 = await get('/api/state');
  const postNoUid2Wallet = stateRes6.data.wallets.find(w => w.id === initialDefaultWallet.id);
  const postNoUid2TxCount = stateRes6.data.transactions.length;
  challenge(
    postNoUid2Wallet.balance === postNoUid1Wallet.balance,
    `Balance Protection: Wallet balance strictly unchanged on missing update_id duplicate (${postNoUid2Wallet.balance} === ${postNoUid1Wallet.balance})`
  );
  challenge(
    postNoUid2TxCount === postNoUid1TxCount,
    `Transaction Protection: Transaction count strictly unchanged on missing update_id duplicate`
  );

  // Test 2.6: Rapid Burst / Concurrent Webhook Calls
  const burstUid = nextUid();
  const burstPayload = {
    update_id: burstUid,
    message: { text: 'Bayar pulsa darurat 15rb' }
  };
  const burstResponses = await Promise.all([
    post('/api/telegram/webhook', burstPayload),
    post('/api/telegram/webhook', burstPayload),
    post('/api/telegram/webhook', burstPayload),
    post('/api/telegram/webhook', burstPayload),
  ]);

  const acceptedCount = burstResponses.filter(r => r.data.transaction).length;
  const deduplicatedCount = burstResponses.filter(r => r.data.skipped_reason === 'idempotent_duplicate').length;
  challenge(
    acceptedCount === 1,
    `Concurrent Burst: Exactly 1 request accepted out of 4 concurrent duplicates (accepted: ${acceptedCount})`
  );
  challenge(
    deduplicatedCount === 3,
    `Concurrent Burst: Exactly 3 requests deduplicated with idempotent_duplicate (deduped: ${deduplicatedCount})`
  );

  const stateRes7 = await get('/api/state');
  const postBurstWallet = stateRes7.data.wallets.find(w => w.id === initialDefaultWallet.id);
  challenge(
    postBurstWallet.balance === postNoUid1Wallet.balance - 15000,
    `Concurrent Balance Protection: Wallet balance decremented exactly once by 15.000`
  );

  // ==================================================================
  // PART 3: ADMIN APPROVAL STATE MACHINE & FILTERING ADVERSARIAL TESTS
  // ==================================================================
  console.log('\n--- [CHALLENGE 3] ADMIN APPROVAL STATE MACHINE & FILTERING ---');

  // Reset database state before Admin Approval tests
  await post('/api/test/reset-state');

  // Test 3.1: Status Filter Casing Adversarial Tests
  const filterPendingLower = await get('/api/admin/approvals?status=pending');
  const filterPendingUpper = await get('/api/admin/approvals?status=PENDING');
  const filterPendingMixed = await get('/api/admin/approvals?status=pEnDiNg');
  const filterPendingCap = await get('/api/admin/approvals?status=Pending');

  challenge(
    filterPendingLower.status === 200 && filterPendingLower.data.approvals.length > 0,
    'Status filter: ?status=pending returns 200 with pending approvals'
  );
  challenge(
    filterPendingUpper.data.approvals.length === filterPendingLower.data.approvals.length,
    'Status filter casing: ?status=PENDING returns identical count to lowercase pending',
    `upper: ${filterPendingUpper.data.approvals.length}, lower: ${filterPendingLower.data.approvals.length}`
  );
  challenge(
    filterPendingMixed.data.approvals.length === filterPendingLower.data.approvals.length,
    'Status filter casing: ?status=pEnDiNg returns identical count to lowercase pending'
  );
  challenge(
    filterPendingCap.data.approvals.length === filterPendingLower.data.approvals.length,
    'Status filter casing: ?status=Pending returns identical count to lowercase pending'
  );

  // Test 3.2: Approved & Rejected Status Filter Casing
  const filterApprovedUpper = await get('/api/admin/approvals?status=APPROVED');
  const filterApprovedCap = await get('/api/admin/approvals?status=Approved');
  const filterApprovedLower = await get('/api/admin/approvals?status=approved');
  challenge(
    filterApprovedUpper.data.approvals.length === filterApprovedLower.data.approvals.length &&
    filterApprovedCap.data.approvals.length === filterApprovedLower.data.approvals.length,
    'Status filter casing: ?status=APPROVED / Approved handles casing accurately'
  );

  const filterRejectedUpper = await get('/api/admin/approvals?status=REJECTED');
  const filterRejectedLower = await get('/api/admin/approvals?status=rejected');
  challenge(
    filterRejectedUpper.data.approvals.length === filterRejectedLower.data.approvals.length,
    'Status filter casing: ?status=REJECTED handles casing accurately'
  );

  // Test 3.3: Category Filter Casing
  const catFilterUpper = await get('/api/admin/approvals?category=PLAN_UPGRADE');
  const catFilterLower = await get('/api/admin/approvals?category=plan_upgrade');
  challenge(
    catFilterUpper.data.approvals.length === catFilterLower.data.approvals.length,
    'Category filter casing: ?category=PLAN_UPGRADE matches lowercase count'
  );

  // Test 3.4: Create Fresh Pending Approvals for State Machine Stress Testing
  const freshAppr1 = await post('/api/admin/approvals', {
    id: 'appr_adv_001',
    user_id: 'usr_siti_002',
    user_name: 'Siti Rahmawati',
    category: 'wallet_topup',
    title: 'Top-up Saldo BCA Rp 500.000',
    amount: 500000
  });
  challenge(
    freshAppr1.status === 201 && freshAppr1.data.approval && freshAppr1.data.approval.status === 'pending',
    'Admin Approval Setup: Created fresh approval request appr_adv_001 with pending status'
  );

  // Test 3.5: Approve pending request
  const approveRes1 = await post('/api/admin/approvals/action', {
    id: 'appr_adv_001',
    action: 'approve',
    note: 'Disetujui untuk uji coba'
  });
  challenge(
    approveRes1.status === 200 && approveRes1.data.approval.status === 'approved',
    'State Machine: 1st approve action succeeds with HTTP 200 and status="approved"'
  );

  // Test 3.6: Re-approving already-approved request MUST return HTTP 400
  const reApproveRes = await post('/api/admin/approvals/action', {
    id: 'appr_adv_001',
    action: 'approve',
    note: 'Mencoba re-approve'
  });
  challenge(
    reApproveRes.status === 400 && reApproveRes.data.error.includes('sudah diproses'),
    'State Machine: Re-approving already-approved request returns HTTP 400 with duplicate protection error',
    `status: ${reApproveRes.status}, error: ${reApproveRes.data.error}`
  );

  // Test 3.7: Attempting to reject an already-approved request MUST return HTTP 400
  const rejectApprovedRes = await post('/api/admin/approvals/action', {
    id: 'appr_adv_001',
    action: 'reject',
    reason: 'Mencoba reject setelah approved'
  });
  challenge(
    rejectApprovedRes.status === 400,
    'State Machine: Attempting to reject already-approved request returns HTTP 400',
    `status: ${rejectApprovedRes.status}`
  );

  // Test 3.8: Rejection without reason MUST return HTTP 400
  const freshAppr2 = await post('/api/admin/approvals', {
    id: 'appr_adv_002',
    user_id: 'usr_siti_002',
    user_name: 'Siti Rahmawati',
    category: 'plan_upgrade',
    title: 'Upgrade Paket Pro Manual Rp 99.000',
    amount: 99000
  });

  const rejectNoReason = await post('/api/admin/approvals/action', {
    id: 'appr_adv_002',
    action: 'reject'
  });
  challenge(
    rejectNoReason.status === 400 && rejectNoReason.data.error.includes('Alasan penolakan'),
    'State Machine: Rejecting without reason returns HTTP 400 with mandatory reason error',
    `status: ${rejectNoReason.status}, error: ${rejectNoReason.data.error}`
  );

  // Test 3.9: Rejection with empty / whitespace-only reason MUST return HTTP 400
  const rejectWhitespace = await post('/api/admin/approvals/action', {
    id: 'appr_adv_002',
    action: 'reject',
    reason: '    \t   \n   '
  });
  challenge(
    rejectWhitespace.status === 400 && rejectWhitespace.data.error.includes('Alasan penolakan'),
    'State Machine: Rejecting with whitespace-only reason returns HTTP 400',
    `status: ${rejectWhitespace.status}, error: ${rejectWhitespace.data.error}`
  );

  // Verify appr_adv_002 is STILL in pending status after failed rejections
  const apprCheck = await get('/api/admin/approvals?status=pending');
  const foundPending = apprCheck.data.approvals.find(a => a.id === 'appr_adv_002');
  challenge(
    foundPending && foundPending.status === 'pending',
    'State Machine: Approval request remains strictly pending after failed rejection attempts'
  );

  // Test 3.10: Rejection with valid reason succeeds with HTTP 200
  const stateBeforeReject = await get('/api/state');
  const userBeforeReject = stateBeforeReject.data.allUsers.find(u => u.id === 'usr_siti_002');
  const userPlanBeforeReject = userBeforeReject ? userBeforeReject.plan : 'starter';

  const rejectValid = await post('/api/admin/approvals/action', {
    id: 'appr_adv_002',
    action: 'reject',
    reason: 'Bukti transfer mutasi tidak valid / tidak terbaca'
  });
  challenge(
    rejectValid.status === 200 && rejectValid.data.approval.status === 'rejected',
    'State Machine: Rejecting with valid reason succeeds with HTTP 200 and status="rejected"'
  );
  challenge(
    rejectValid.data.approval.admin_notes === 'Bukti transfer mutasi tidak valid / tidak terbaca',
    'State Machine: Rejection reason accurately stored in admin_notes'
  );

  // Verify User Plan strictly UNCHANGED after rejection
  const stateAfterReject = await get('/api/state');
  const userAfterReject = stateAfterReject.data.allUsers.find(u => u.id === 'usr_siti_002');
  const userPlanAfterReject = userAfterReject ? userAfterReject.plan : 'starter';
  challenge(
    userPlanAfterReject === userPlanBeforeReject,
    `Side-effect Protection: User plan strictly unchanged after rejection (${userPlanAfterReject} === ${userPlanBeforeReject})`
  );

  // Test 3.11: Re-rejecting already-rejected request MUST return HTTP 400
  const reRejectRes = await post('/api/admin/approvals/action', {
    id: 'appr_adv_002',
    action: 'reject',
    reason: 'Mencoba re-reject'
  });
  challenge(
    reRejectRes.status === 400 && reRejectRes.data.error.includes('sudah diproses'),
    'State Machine: Re-rejecting already-rejected request returns HTTP 400'
  );

  // Test 3.12: Attempting to approve an already-rejected request MUST return HTTP 400
  const approveRejectedRes = await post('/api/admin/approvals/action', {
    id: 'appr_adv_002',
    action: 'approve',
    note: 'Mencoba approve yang sudah ditolak'
  });
  challenge(
    approveRejectedRes.status === 400,
    'State Machine: Attempting to approve already-rejected request returns HTTP 400'
  );

  // Test 3.13: Non-existent approval ID returns 404
  const notFoundRes = await post('/api/admin/approvals/action', {
    id: 'appr_non_existent_99999',
    action: 'approve'
  });
  challenge(
    notFoundRes.status === 404,
    'Error Handling: Non-existent approval ID returns HTTP 404',
    `status: ${notFoundRes.status}`
  );

  // Test 3.14: Invalid action returns 400
  const invalidActionRes = await post('/api/admin/approvals/action', {
    id: 'appr_adv_001',
    action: 'destroy'
  });
  challenge(
    invalidActionRes.status === 400,
    'Error Handling: Invalid action parameter ("destroy") returns HTTP 400',
    `status: ${invalidActionRes.status}`
  );

  // Test 3.15: Audit log contains recorded actions
  const auditRes = await get('/api/admin/audit-logs');
  const logs = auditRes.data.auditLogs || [];
  const rejectAuditLog = logs.find(l => l.details && l.details.approval_id === 'appr_adv_002');
  challenge(
    rejectAuditLog && rejectAuditLog.details.reason === 'Bukti transfer mutasi tidak valid / tidak terbaca',
    'Audit Trail: Rejection audit log recorded with exact mandatory reason'
  );

  // ==================================================================
  // SUMMARY REPORT
  // ==================================================================
  console.log('\n======================================================');
  console.log(`📊 EMPIRICAL CHALLENGER RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('======================================================\n');

  if (failures.length > 0) {
    console.error('⚠️  FAILURES ENCOUNTERED:');
    failures.forEach((f, idx) => console.error(`${idx + 1}. ${f.name} (${f.details})`));
  }

  return { passed, total, failures };
}

runAdversarialSuite().then(result => {
  if (result.failures.length === 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
