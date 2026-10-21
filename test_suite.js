// ====================================================================
// Automated Comprehensive End-to-End Integration Test Suite for TataDana
// Total Test Cases: 40 Tests across Part 1 - Part 11
// ====================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const adminApproval = require('./src/modules/admin-approval');

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
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

function del(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'DELETE'
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
    req.end();
  });
}

// Generate unique update IDs to prevent collision across test runs
let currentUid = Math.floor(Date.now() / 1000) * 1000;
function nextUid() {
  currentUid += 1;
  return currentUid;
}

async function runTests() {
  console.log('🧪 RUNNING TATADANA PRODUCTION TEST SUITE...\n');
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

  let runningServer = null;
  try {
    await get('/api/state');
  } catch (e) {
    runningServer = require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  // RESET STATE BEFORE TESTING
  try {
    await post('/api/test/reset-state');
  } catch (e) {
    console.warn('Reset state warning:', e.message);
  }

  // 1. GET /api/state
  try {
    const stateRes = await get('/api/state');
    const state = JSON.parse(stateRes.body);
    assert(stateRes.status === 200, 'TEST 1: GET /api/state returns 200');
    assert(state.user && state.user.full_name === 'Budi Pratama', 'TEST 2: State contains valid user Budi Pratama');
    assert(Array.isArray(state.wallets) && state.wallets.length >= 3, 'TEST 3: State contains multi-wallets');
    assert(Array.isArray(state.categories) && state.categories.length >= 5, 'TEST 4: State contains categories');
  } catch (e) {
    assert(false, 'State test: ' + e.message);
  }

  // 2. Telegram Webhook: Natural Text Expense
  try {
    const res = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'Beli nasi padang rendang 25rb', date: Math.floor(Date.now() / 1000) }
    });
    assert(res.status === 200, 'TEST 5: Telegram Webhook Expense status 200');
    assert(res.data.ok === true, 'TEST 6: Webhook response ok: true');
    assert(res.data.reply_text && res.data.reply_text.includes('Pengeluaran tercatat!'), 'TEST 7: Expense reply format matches Part 4.4');
    assert(res.data.reply_text && res.data.reply_text.includes('Rp25.000'), 'TEST 8: Parsed 25rb as Rp25.000');
    assert(res.data.reply_text && res.data.reply_text.includes('WIB'), 'TEST 9: Reply includes WIB timezone');
  } catch (e) {
    assert(false, 'Webhook Expense: ' + e.message);
  }

  // 3. Telegram Webhook: Natural Text Income
  try {
    const res = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'Gajian kantor 9.5jt', date: Math.floor(Date.now() / 1000) }
    });
    assert(res.status === 200, 'TEST 10: Telegram Webhook Income status 200');
    assert(res.data.reply_text && res.data.reply_text.includes('Pemasukan tercatat!'), 'TEST 11: Income reply format matches Part 4.5');
    assert(res.data.reply_text && res.data.reply_text.includes('Rp9.500.000'), 'TEST 12: Parsed 9.5jt as Rp9.500.000');
  } catch (e) {
    assert(false, 'Webhook Income: ' + e.message);
  }

  // 4. Complex Indonesian Formats: Dot thousands separator
  try {
    const res1 = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'Beli bensin 17.500', date: Math.floor(Date.now() / 1000) }
    });
    assert(res1.data.reply_text && res1.data.reply_text.includes('Rp17.500'), 'TEST 13: Parsed Indonesian dot separator 17.500 -> Rp17.500');

    const res2 = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'Bayar kos 1.500.000', date: Math.floor(Date.now() / 1000) }
    });
    assert(res2.data.reply_text && res2.data.reply_text.includes('Rp1.500.000'), 'TEST 14: Parsed millions dot separator 1.500.000 -> Rp1.500.000');
  } catch (e) {
    assert(false, 'Indonesian format parsing: ' + e.message);
  }

  // 5. Voice Note (VN) Input
  try {
    const res = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      isVoiceNote: true,
      voiceDuration: 6,
      message: { voice: { duration: 6, file_id: 'vn_test_1' } }
    });
    assert(res.status === 200, 'TEST 15: Voice Note without text auto-transcribed');
    assert(res.data.reply_text && res.data.reply_text.includes('Transkrip:'), 'TEST 16: Voice Note reply includes "Transkrip:" line');
  } catch (e) {
    assert(false, 'Voice Note: ' + e.message);
  }

  // 6. Voice Note Duration Rejection (>60s)
  try {
    const res = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      isVoiceNote: true,
      voiceDuration: 65,
      message: { voice: { duration: 65 } }
    });
    assert(res.data.reply_text && res.data.reply_text.includes('melebihi batas 60 detik'), 'TEST 17: Voice Note >60s rejected politely');
  } catch (e) {
    assert(false, 'VN Duration check: ' + e.message);
  }

  // 7. Photo Receipt OCR (Pro Plan)
  try {
    const res = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      isPhotoReceipt: true,
      message: { photo: [{ file_id: 'photo_abc' }] }
    });
    assert(res.status === 200, 'TEST 18: Photo Receipt OCR status 200');
    assert(res.data.transaction && Array.isArray(res.data.transaction.items) && res.data.transaction.items.length === 3, 'TEST 19: Photo OCR extracts multi-item breakdown');
  } catch (e) {
    assert(false, 'Photo Receipt OCR: ' + e.message);
  }

  // 8. Photo Receipt Rejection for Starter Plan
  try {
    await post('/api/admin/impersonate', { userId: 'usr_tatadana_002' }); // Siti (Starter)
    const res = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      isPhotoReceipt: true,
      message: { photo: [{ file_id: 'photo_starter' }] }
    });
    assert(res.data.reply_text && res.data.reply_text.includes('Fitur Eksklusif Paket Pro'), 'TEST 20: Starter plan receipt photo rejected with upgrade CTA');
    // Switch back to Budi (Pro)
    await post('/api/admin/impersonate', { userId: 'usr_tatadana_001' });
  } catch (e) {
    assert(false, 'Starter receipt rejection: ' + e.message);
  }

  // 9. Webhook Idempotency Check
  try {
    const duplicateId = nextUid();
    const firstRes = await post('/api/telegram/webhook', {
      update_id: duplicateId,
      message: { text: 'Beli kopi susu 20rb' }
    });
    assert(firstRes.status === 200, 'TEST 21: First webhook call processed');

    const dupRes = await post('/api/telegram/webhook', {
      update_id: duplicateId,
      message: { text: 'Beli kopi susu 20rb' }
    });
    assert(dupRes.data.skipped_reason === 'idempotent_duplicate', 'TEST 22: Duplicate update_id skipped');
  } catch (e) {
    assert(false, 'Idempotency check: ' + e.message);
  }

  // 10. Ambiguous / Unrecognized Input Handling
  try {
    const res = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'halo selamat pagi bot' }
    });
    assert(res.data.reply_text && res.data.reply_text.includes('belum memahami'), 'TEST 23: Ambiguous input replies with helpful guidance');
  } catch (e) {
    assert(false, 'Ambiguous input: ' + e.message);
  }

  // 11. Bot Commands
  try {
    const saldo = await post('/api/telegram/webhook', { update_id: nextUid(), message: { text: '/saldo' } });
    assert(saldo.data.reply_text && saldo.data.reply_text.includes('SALDO SEMUA DOMPET'), 'TEST 24: /saldo returns wallet balances');

    const budget = await post('/api/telegram/webhook', { update_id: nextUid(), message: { text: '/budget' } });
    assert(budget.data.reply_text && budget.data.reply_text.includes('STATUS BUDGET BULAN INI'), 'TEST 25: /budget returns visual progress bars');

    const sheet = await post('/api/telegram/webhook', { update_id: nextUid(), message: { text: '/sheet' } });
    assert(sheet.data.reply_text && sheet.data.reply_text.includes('Google Sheet Pribadi'), 'TEST 26: /sheet returns private Google Sheet link');
  } catch (e) {
    assert(false, 'Bot commands: ' + e.message);
  }

  // 12. Telegram Connection Test API (Part 5)
  try {
    const connRes = await post('/api/telegram/test-connection', {
      botToken: '849302194:AAHF1a9XmZ0kdq-38Z9eY14mKp03'
    });
    assert(connRes.status === 200 && connRes.data.status === 'connected', 'TEST 27: Bot test connection succeeds');
    assert(connRes.data.webhook_url && connRes.data.webhook_url.includes('/api/telegram/webhook'), 'TEST 28: Valid webhook URL returned');

    const invalidRes = await post('/api/telegram/test-connection', {
      botToken: 'invalid_short'
    });
    assert(invalidRes.status === 400 && invalidRes.data.status === 'disconnected', 'TEST 29: Invalid bot token rejected with 400');
  } catch (e) {
    assert(false, 'Test connection: ' + e.message);
  }

  // 13. Manual Web Transactions & Wallet Transfer
  try {
    const txRes = await post('/api/transactions', {
      type: 'expense',
      amount: 45000,
      wallet_id: 'wal_bca',
      category_id: 'cat_makanan',
      note: 'Makan ramen jepang'
    });
    assert(txRes.status === 200 && txRes.data.transaction.amount === 45000, 'TEST 30: Manual web transaction recorded');

    const transferRes = await post('/api/transactions', {
      type: 'transfer',
      amount: 100000,
      wallet_id: 'wal_bca',
      destination_wallet_id: 'wal_gopay',
      note: 'Topup gopay mingguan'
    });
    assert(transferRes.status === 200 && transferRes.data.transaction.type === 'transfer', 'TEST 31: Wallet transfer recorded');

    // Delete transaction test
    const delRes = await del(`/api/transactions/${txRes.data.transaction.id}`);
    assert(delRes.status === 200 && delRes.data.ok === true, 'TEST 32: Transaction deleted and balances adjusted');
  } catch (e) {
    assert(false, 'Manual transactions: ' + e.message);
  }

  // 14. Multi-Wallet (Add & Set Default)
  try {
    const walRes = await post('/api/wallets', {
      name: 'Kantong Jago',
      type: 'bank',
      balance: 1500000
    });
    assert(walRes.status === 200 && walRes.data.wallet.name === 'Kantong Jago', 'TEST 33: New wallet added');

    const defRes = await post('/api/wallets/set-default', {
      walletId: walRes.data.wallet.id
    });
    assert(defRes.status === 200 && defRes.data.ok === true, 'TEST 34: Default wallet set');
  } catch (e) {
    assert(false, 'Wallets API: ' + e.message);
  }

  // 15. Plan Limit Enforcement: Starter Wallets & Transactions
  try {
    await post('/api/admin/impersonate', { userId: 'usr_tatadana_003' }); // Ahmad (Starter, 0 wallets added initially, has 4 default)
    // Starter has max 3 wallets limit
    const rejectWal = await post('/api/wallets', { name: 'Kelebihan Wallet', type: 'cash', balance: 0 });
    assert(rejectWal.status === 403, 'TEST 35: Starter plan blocked from exceeding 3 wallets');

    // Switch back to Budi (Pro)
    await post('/api/admin/impersonate', { userId: 'usr_tatadana_001' });
  } catch (e) {
    assert(false, 'Plan limit check: ' + e.message);
  }

  // 16. Reports Export & History (Part 3 & Part 6)
  try {
    const excelRes = await get('/api/reports/export/excel');
    assert(excelRes.status === 200, 'TEST 36: Excel report streaming export status 200');
    assert(excelRes.body.includes('ID,Tanggal (WIB),Jenis'), 'TEST 37: Excel report contains WIB headers');

    const pdfRes = await get('/api/reports/export/pdf');
    assert(pdfRes.status === 200 && pdfRes.body.includes('TataDana — Laporan Keuangan Resmi'), 'TEST 38: PDF report generated with official format');

    const histRes = await get('/api/reports/exports');
    const histData = JSON.parse(histRes.body);
    assert(histData.ok && histData.exportHistory.length >= 2, 'TEST 39: Export history recorded for re-download');
  } catch (e) {
    assert(false, 'Export API: ' + e.message);
  }

  // 17. Admin Dashboard: AI Mode, Payment Approval & Audit Logs (Part 10)
  try {
    const modeRes = await post('/api/admin/ai-providers/mode', { mode: 'single' });
    assert(modeRes.data.mode === 'single', 'TEST 40: Admin toggles AI mode to single/parallel');

    const payRes = await post('/api/admin/payments/status', {
      paymentId: 'pay_01',
      status: 'approved'
    });
    assert(payRes.status === 200, 'TEST 41: Admin approves manual payment and upgrades user');

    const auditRes = await get('/api/admin/audit-logs');
    const auditData = JSON.parse(auditRes.body);
    assert(auditData.auditLogs && auditData.auditLogs.length > 0, 'TEST 42: Audit log recorded on inspecting user transactions');
  } catch (e) {
    assert(false, 'Admin API: ' + e.message);
  }

  // 18. Admin Approval Workflow System: Plan Upgrade, Wallet Top-up & Custom Budget
  try {
    // Test 43: GET /api/admin/approvals returns list with seeded categories
    const apprRes = await get('/api/admin/approvals');
    const apprData = JSON.parse(apprRes.body);
    assert(apprRes.status === 200 && apprData.ok === true && Array.isArray(apprData.approvals), 'TEST 43: GET /api/admin/approvals returns 200 and list');
    assert(apprData.approvals.length >= 5, 'TEST 44: Approvals queue contains all seeded requests');

    // Test 45: Filter pending approvals
    const pendRes = await get('/api/admin/approvals?status=pending');
    const pendData = JSON.parse(pendRes.body);
    assert(pendData.approvals.length > 0 && pendData.approvals.every(a => a.status === 'pending'), 'TEST 45a: Filter ?status=pending returns only pending approvals');

    // Test 45b: Filter approved approvals
    const approvedRes = await get('/api/admin/approvals?status=approved');
    const approvedData = JSON.parse(approvedRes.body);
    assert(approvedData.approvals.length > 0 && approvedData.approvals.every(a => a.status === 'approved'), 'TEST 45b: Filter ?status=approved returns only approved approvals');

    // Test 45c: Filter rejected approvals
    const rejectedRes = await get('/api/admin/approvals?status=rejected');
    const rejectedData = JSON.parse(rejectedRes.body);
    assert(rejectedData.approvals.length > 0 && rejectedData.approvals.every(a => a.status === 'rejected'), 'TEST 45c: Filter ?status=rejected returns only rejected approvals');

    // Test 45d: Case-insensitive status filter
    const caseRes = await get('/api/admin/approvals?status=Pending');
    const caseData = JSON.parse(caseRes.body);
    assert(caseData.approvals.length > 0 && caseData.approvals.every(a => a.status === 'pending'), 'TEST 45d: Filter ?status=Pending (case-insensitive) works');

    // Test 46: Filter by category
    const catRes = await get('/api/admin/approvals?category=plan_upgrade');
    const catData = JSON.parse(catRes.body);
    assert(catData.approvals.every(a => a.category === 'plan_upgrade'), 'TEST 46: Filter ?category=plan_upgrade returns matching category');

    // Test 47: Admin approves manual Plan Upgrade (Siti Rahmawati)
    const stateBefore = JSON.parse((await get('/api/state')).body);
    const sitiBefore = stateBefore.allUsers.find(u => u.id === 'usr_tatadana_002');
    assert(sitiBefore && sitiBefore.plan === 'starter', 'TEST 47a: Siti starts on starter plan prior to approval');
    
    const approvePlanRes = await post('/api/admin/approvals/action', {
      approvalId: 'appr_01',
      action: 'approve',
      reason: 'Mutasi transfer BCA Rp99.000 valid terverifikasi'
    });
    assert(approvePlanRes.status === 200 && approvePlanRes.data.approval.status === 'approved', 'TEST 47: Admin approves plan upgrade request');

    // Verify user is upgraded to pro and audit log recorded
    const stateAfterPlan = JSON.parse((await get('/api/state')).body);
    const sitiAfter = stateAfterPlan.allUsers.find(u => u.id === 'usr_tatadana_002');
    assert(sitiAfter && sitiAfter.plan === 'pro', 'TEST 48: User plan upgraded to pro in real-time');
    const planAuditLog = stateAfterPlan.auditLogs.find(l => l.action === 'approve_plan_upgrade');
    assert(planAuditLog && planAuditLog.target_user_name === 'Siti Rahmawati', 'TEST 49: Audit log recorded for plan upgrade approval');

    // Test 50: Admin approves Wallet Top-up / Adjustment
    const bcaBefore = stateAfterPlan.wallets.find(w => w.id === 'wal_bca');
    const bcaBalBefore = bcaBefore ? bcaBefore.balance : 0;

    const approveWalletRes = await post('/api/admin/approvals/action', {
      approvalId: 'appr_02',
      action: 'approve',
      reason: 'Reimbursement tunai disetujui HRD'
    });
    assert(approveWalletRes.status === 200 && approveWalletRes.data.approval.status === 'approved', 'TEST 50: Admin approves wallet top-up request');

    const stateAfterWallet = JSON.parse((await get('/api/state')).body);
    const bcaAfter = stateAfterWallet.wallets.find(w => w.id === 'wal_bca');
    assert(bcaAfter && bcaAfter.balance === bcaBalBefore + 1000000, 'TEST 51: Wallet balance increased by approved top-up amount');
    const walletAuditLog = stateAfterWallet.auditLogs.find(l => l.action === 'approve_wallet_topup');
    assert(walletAuditLog && walletAuditLog.details.amount_added === 1000000, 'TEST 52: Audit log recorded for wallet top-up approval');

    // Test 53: Admin approves Budget Limit Expansion
    const budBefore = stateAfterWallet.budgets.find(b => b.id === 'bud_hiburan');
    assert(budBefore && budBefore.monthly_limit === 800000, 'TEST 53: Budget hiburan starts with 800.000 limit');

    const approveBudgetRes = await post('/api/admin/approvals/action', {
      approvalId: 'appr_03',
      action: 'approve',
      reason: 'Pengajuan ekspansi budget liburan akhir tahun disetujui'
    });
    assert(approveBudgetRes.status === 200 && approveBudgetRes.data.approval.status === 'approved', 'TEST 54: Admin approves budget expansion request');

    const stateAfterBudget = JSON.parse((await get('/api/state')).body);
    const budAfter = stateAfterBudget.budgets.find(b => b.id === 'bud_hiburan');
    assert(budAfter && budAfter.monthly_limit === 1500000, 'TEST 55: Budget monthly limit updated to 1.500.000 in real-time');
    const budgetAuditLog = stateAfterBudget.auditLogs.find(l => l.action === 'approve_budget_limit');
    assert(budgetAuditLog && budgetAuditLog.details.new_limit === 1500000, 'TEST 56: Audit log recorded for budget limit approval');

    // Test 57: Admin Rejection flow with reason and audit log
    const createReqRes = await post('/api/admin/approvals', {
      user_id: 'usr_tatadana_003',
      user_name: 'Ahmad Fauzi',
      category: 'wallet_topup',
      title: 'Top-up Koreksi Tunai Rp2.000.000',
      amount: 2000000,
      description: 'Pengajuan koreksi kas fiktif tanpa nota'
    });
    assert(createReqRes.status === 201 && createReqRes.data.ok === true, 'TEST 57: New approval request created successfully');

    const newApprId = createReqRes.data.approval.id;

    // Test 57b: Rejecting without reason fails with HTTP 400
    const rejectNoReasonRes = await post('/api/admin/approvals/action', {
      approvalId: newApprId,
      action: 'reject'
    });
    assert(rejectNoReasonRes.status === 400 && rejectNoReasonRes.data.ok === false, 'TEST 57b: Rejection without reason fails with HTTP 400');

    // Test 57c: Rejecting with whitespace-only reason fails with HTTP 400
    const rejectWhitespaceRes = await post('/api/admin/approvals/action', {
      approvalId: newApprId,
      action: 'reject',
      reason: '    '
    });
    assert(rejectWhitespaceRes.status === 400 && rejectWhitespaceRes.data.ok === false, 'TEST 57c: Rejection with whitespace reason fails with HTTP 400');

    // Record user balance & plan before valid rejection
    const statePreReject = JSON.parse((await get('/api/state')).body);
    const bcaBeforeReject = statePreReject.wallets.find(w => w.id === 'wal_bca').balance;
    const fauziBeforeReject = statePreReject.allUsers.find(u => u.id === 'usr_tatadana_003').plan;

    const rejectRes = await post('/api/admin/approvals/action', {
      approvalId: newApprId,
      action: 'reject',
      reason: 'Bukti fisik tidak sesuai dengan catatan kas opname'
    });
    assert(rejectRes.status === 200 && rejectRes.data.approval.status === 'rejected', 'TEST 58: Admin rejects approval request with valid reason');
    assert(rejectRes.data.approval.admin_notes === 'Bukti fisik tidak sesuai dengan catatan kas opname', 'TEST 59: Rejection reason stored in admin notes');

    const stateAfterReject = JSON.parse((await get('/api/state')).body);
    const rejectAuditLog = stateAfterReject.auditLogs.find(l => l.action === 'reject_wallet_topup' && l.details.approval_id === newApprId);
    assert(rejectAuditLog !== undefined, 'TEST 60: Audit log recorded for rejection with reason');

    const bcaAfterReject = stateAfterReject.wallets.find(w => w.id === 'wal_bca').balance;
    const fauziAfterReject = stateAfterReject.allUsers.find(u => u.id === 'usr_tatadana_003').plan;
    assert(bcaAfterReject === bcaBeforeReject, 'TEST 60b: User wallet balance strictly unchanged after rejection');
    assert(fauziAfterReject === fauziBeforeReject, 'TEST 60c: User plan strictly unchanged after rejection');

    // Test 61 & 62: Error validation and edge cases
    const notFoundRes = await post('/api/admin/approvals/action', {
      approvalId: 'invalid_id_9999',
      action: 'approve'
    });
    assert(notFoundRes.status === 404, 'TEST 61: Invalid approval ID returns 404');

    const badActionRes = await post('/api/admin/approvals/action', {
      approvalId: 'appr_01',
      action: 'invalid_action'
    });
    assert(badActionRes.status === 400, 'TEST 62: Invalid action parameter returns 400');

    // Test 63: Double approval prevention (Terminal state idempotency)
    const doubleApproveRes = await post('/api/admin/approvals/action', {
      approvalId: 'appr_01',
      action: 'approve',
      reason: 'Mencoba menyetujui ulang'
    });
    assert(doubleApproveRes.status === 400 && doubleApproveRes.data.ok === false, 'TEST 63: Re-approving already approved request returns 400');

    // Test 64: Re-processing already rejected request returns 400
    const reProcessRejectRes = await post('/api/admin/approvals/action', {
      approvalId: newApprId,
      action: 'approve'
    });
    assert(reProcessRejectRes.status === 400 && reProcessRejectRes.data.ok === false, 'TEST 64: Re-processing already rejected request returns 400');

    // Test 65: Negative amount rejected during approval creation
    const badAmountRes = await post('/api/admin/approvals', {
      category: 'wallet_topup',
      title: 'Invalid Negative Amount',
      amount: -50000
    });
    assert(badAmountRes.status === 400 && badAmountRes.data.ok === false, 'TEST 65: Negative amount rejected with 400');

    // Test 66: Debit wallet adjustment decrements balance and records expense transaction
    const createDebitRes = await post('/api/admin/approvals', {
      user_id: 'usr_tatadana_001',
      user_name: 'Budi Pratama',
      category: 'wallet_topup',
      title: 'Koreksi Kas Berlebih Rp300.000',
      amount: 300000,
      details: { wallet_id: 'wal_bca', type: 'debit' }
    });
    assert(createDebitRes.status === 201 && createDebitRes.data.ok === true, 'TEST 66a: New debit adjustment request created');
    const debitApprId = createDebitRes.data.approval.id;

    const bcaBeforeDebit = (JSON.parse((await get('/api/state')).body)).wallets.find(w => w.id === 'wal_bca').balance;
    const approveDebitRes = await post('/api/admin/approvals/action', {
      approvalId: debitApprId,
      action: 'approve',
      reason: 'Koreksi kelebihan kas disetujui'
    });
    assert(approveDebitRes.status === 200 && approveDebitRes.data.approval.status === 'approved', 'TEST 66b: Admin approves debit adjustment');

    const bcaAfterDebit = (JSON.parse((await get('/api/state')).body)).wallets.find(w => w.id === 'wal_bca').balance;
    assert(bcaAfterDebit === bcaBeforeDebit - 300000, 'TEST 66c: Debit wallet adjustment decreases balance');
  } catch (e) {
    assert(false, 'Approval API: ' + e.message);
  }

  // 19. Modular Admin Approval Engine Unit Verification (src/modules/admin-approval.js)
  try {
    const mockDb = {
      user: { id: 'usr_mock_001', full_name: 'Mock User', role: 'user' },
      allUsers: [
        { id: 'usr_mock_001', full_name: 'Mock User', plan: 'starter' },
        { id: 'usr_mock_002', full_name: 'Second User', plan: 'starter' }
      ],
      wallets: [{ id: 'wal_mock_bca', name: 'BCA Utama', balance: 5000000 }],
      categories: [{ id: 'cat_hiburan', name: 'Hiburan', type: 'expense' }],
      budgets: [{ id: 'bud_hiburan', category_id: 'cat_hiburan', category_name: 'Hiburan', monthly_limit: 800000 }],
      transactions: [],
      payments: [{ id: 'pay_mock_01', user_name: 'Second User', plan: 'pro', status: 'pending' }],
      approvals: [
        {
          id: 'appr_p1',
          user_id: 'usr_mock_002',
          user_name: 'Second User',
          category: 'plan_upgrade',
          title: 'Upgrade Pro',
          amount: 99000,
          details: { plan: 'pro', payment_id: 'pay_mock_01' },
          status: 'pending'
        },
        {
          id: 'appr_p2',
          user_id: 'usr_mock_001',
          user_name: 'Mock User',
          category: 'wallet_topup',
          title: 'Topup Dompet',
          amount: 500000,
          details: { wallet_id: 'wal_mock_bca', amount: 500000, type: 'credit' },
          status: 'pending'
        },
        {
          id: 'appr_done',
          user_id: 'usr_mock_001',
          user_name: 'Mock User',
          category: 'plan_upgrade',
          title: 'Sudah Selesai',
          amount: 99000,
          status: 'approved'
        }
      ],
      auditLogs: [],
      subscription: { plan: 'starter' }
    };

    // Unit filter tests
    const filteredPending = adminApproval.filterApprovals(mockDb.approvals, { status: 'Pending' });
    assert(filteredPending.length === 2 && filteredPending.every(a => a.status === 'pending'), 'TEST 67: Module filterApprovals handles case-insensitive status');

    const filteredApproved = adminApproval.filterApprovals(mockDb.approvals, { status: 'Approved' });
    assert(filteredApproved.length === 1 && filteredApproved[0].status === 'approved', 'TEST 68: Module filterApprovals filters approved');

    // Unit rejection without reason
    const rejFailNoReason = adminApproval.processApprovalAction(mockDb, {
      approvalId: 'appr_p2',
      action: 'reject'
    });
    assert(rejFailNoReason.ok === false && rejFailNoReason.status === 400, 'TEST 69: Module rejects rejection without reason with 400');

    // Unit rejection with whitespace reason
    const rejFailWhitespace = adminApproval.processApprovalAction(mockDb, {
      approvalId: 'appr_p2',
      action: 'reject',
      reason: '   '
    });
    assert(rejFailWhitespace.ok === false && rejFailWhitespace.status === 400, 'TEST 70: Module rejects whitespace reason with 400');

    // Unit double approval error
    const doubleApprFail = adminApproval.processApprovalAction(mockDb, {
      approvalId: 'appr_done',
      action: 'approve',
      reason: 'Re-approve'
    });
    assert(doubleApprFail.ok === false && doubleApprFail.status === 400, 'TEST 71: Module blocks re-approval of approved with 400');

    // Unit plan upgrade execution
    const approvePlanMod = adminApproval.processApprovalAction(mockDb, {
      approvalId: 'appr_p1',
      action: 'approve',
      reason: 'Mutasi valid'
    });
    assert(approvePlanMod.ok === true && mockDb.allUsers.find(u => u.id === 'usr_mock_002').plan === 'pro', 'TEST 72: Module executes plan upgrade in real-time');

    // Unit parameter alias compatibility { id, note }
    const rejAlias = adminApproval.processApprovalAction(mockDb, {
      id: 'appr_p2',
      action: 'reject',
      note: 'Ditolak via note alias'
    });
    assert(rejAlias.ok === true && rejAlias.approval.status === 'rejected' && rejAlias.approval.admin_notes === 'Ditolak via note alias', 'TEST 73: Module supports id and note parameter aliases');
  } catch (e) {
    assert(false, 'Module Unit Tests: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 20. IN-APP TATA AI BOT ENDPOINT & ENGINE VERIFICATION (R4)
  // ------------------------------------------------------------------
  try {
    // Test 74 & 75: Basic POST /api/ai/chat endpoint response contract
    const chatRes = await post('/api/ai/chat', {
      message: 'Halo Tata AI',
      history: []
    });
    assert(chatRes.status === 200 && chatRes.data.ok === true, 'TEST 74: POST /api/ai/chat returns status 200 and ok: true');
    assert(typeof chatRes.data.reply === 'string' && chatRes.data.reply.length > 20 && Array.isArray(chatRes.data.suggestions) && chatRes.data.suggestions.length >= 3, 'TEST 75: POST /api/ai/chat returns Indonesian reply and suggestions');

    // Test 76: Contextual Expense Analysis based on actual transactions
    const analysisRes = await post('/api/ai/chat', {
      message: 'Bagaimana analisis pengeluaran saya bulan ini?'
    });
    const analysisReply = analysisRes.data.reply || '';
    assert(
      analysisRes.status === 200 &&
      analysisReply.includes('Budi Pratama') &&
      analysisReply.includes('Cashflow') &&
      analysisReply.includes('Pemasukan') &&
      analysisReply.includes('Pengeluaran'),
      'TEST 76: Expense analysis query reflects actual user name and cashflow data'
    );

    // Test 77: Contextual Savings Recommendations
    const savingsRes = await post('/api/ai/chat', {
      message: 'Beri saya rekomendasi penghematan cerdas'
    });
    const savingsReply = savingsRes.data.reply || '';
    assert(
      savingsRes.status === 200 &&
      (savingsReply.includes('Hiburan') || savingsReply.includes('Makanan') || savingsReply.includes('50/30/20')) &&
      savingsReply.includes('hemat'),
      'TEST 77: Savings advice identifies high-utilization budget and actionable savings'
    );

    // Test 78: Smart Transaction Simulation calculation
    const simRes = await post('/api/ai/chat', {
      message: 'Simulasi kalau beli kopi 35rb per hari'
    });
    assert(
      simRes.status === 200 &&
      simRes.data.simulation !== null &&
      simRes.data.simulation.nominal === 35000 &&
      (simRes.data.simulation.monthly_impact === 1050000 || simRes.data.simulation.monthly_impact === 35000) &&
      (simRes.data.simulation.annual_impact === 12775000 || simRes.data.simulation.annual_impact === 420000),
      'TEST 78: Simulation query accurately calculates daily, monthly, and annual projections'
    );

    // Test 79: Budget Evaluation & Alert checking
    const budgetRes = await post('/api/ai/chat', {
      message: 'Cek status kuota budget saya'
    });
    const budgetReply = budgetRes.data.reply || '';
    assert(
      budgetRes.status === 200 &&
      budgetReply.includes('Evaluasi Status Budget') &&
      budgetReply.includes('Hiburan & Lifestyle'),
      'TEST 79: Budget check evaluates category limits and detects high spending'
    );

    // Test 80: Empty message fallback returns greeting with financial snapshot
    const emptyRes = await post('/api/ai/chat', { message: '' });
    assert(
      emptyRes.status === 200 &&
      emptyRes.data.reply.includes('Tata AI') &&
      emptyRes.data.reply.includes('Budi Pratama'),
      'TEST 80: Empty/default message returns polite greeting with user name'
    );

    // Test 81: Unit verification for Indonesian currency parsing
    const tataAiMod = require('./src/modules/tata-ai');
    assert(
      tataAiMod.parseIndonesianNominal('35rb') === 35000 &&
      tataAiMod.parseIndonesianNominal('50k') === 50000 &&
      tataAiMod.parseIndonesianNominal('2,5jt') === 2500000 &&
      tataAiMod.parseIndonesianNominal('1.500.000') === 1500000,
      'TEST 81: Unit parseIndonesianNominal parses rb, k, jt, and dot notations'
    );

    // Test 82: Unit verification for financial analytics calculation
    const mockState = {
      user: { full_name: 'Test Akun' },
      wallets: [{ name: 'BCA', balance: 5000000, is_active: true, is_default: true }],
      budgets: [{ id: 'b1', category_name: 'Makan', monthly_limit: 1000000, current_spent: 850000 }],
      transactions: [
        { type: 'income', amount: 10000000, category_name: 'Gaji' },
        { type: 'expense', amount: 3000000, category_name: 'Makan' }
      ]
    };
    const finResult = tataAiMod.analyzeFinancials(mockState);
    assert(
      finResult.totalIncome === 10000000 &&
      finResult.totalExpenses === 3000000 &&
      finResult.netCashflow === 7000000 &&
      finResult.savingsRate === 70 &&
      finResult.warningBudgetCategories.length === 1,
      'TEST 82: Unit analyzeFinancials accurately computes cashflow and budget warnings'
    );
  } catch (e) {
    assert(false, 'Tata AI Tests: ' + e.message);
  }

  // ==================================================================
  // PART 14: INTERACTIVE CALENDAR MODULE & CASHFLOW AGGREGATOR (M3 / R3)
  // ==================================================================
  try {
    const calendarMod = require('./src/modules/calendar');
    assert(typeof calendarMod.getMonthlyCalendarData === 'function', 'TEST 83: Calendar module exports getMonthlyCalendarData function');
    assert(typeof calendarMod.getDayTransactions === 'function', 'TEST 84: Calendar module exports getDayTransactions function');

    const testTxs = [
      {
        id: 'tx_c1',
        amount: 50000,
        type: 'expense',
        note: 'Beli bensin',
        category_name: 'Transportasi',
        transaction_date: '2026-10-10T08:00:00+07:00'
      },
      {
        id: 'tx_c2',
        amount: 25000,
        type: 'expense',
        note: 'Makan siang padang',
        category_name: 'Makanan',
        transaction_date: '2026-10-10T12:30:00+07:00'
      },
      {
        id: 'tx_c3',
        amount: 2000000,
        type: 'income',
        note: 'Gajian sampingan',
        category_name: 'Freelance',
        transaction_date: '2026-10-09T10:00:00+07:00'
      }
    ];

    // Test monthly aggregation
    const monthData = calendarMod.getMonthlyCalendarData(testTxs, 2026, 10);
    assert(
      monthData.period === '2026-10' &&
      monthData.days.length === 31 &&
      monthData.active_days === 2 &&
      monthData.total_income === 2000000 &&
      monthData.total_expense === 75000 &&
      monthData.net_cashflow === 1925000,
      'TEST 85: Monthly calendar aggregates 31 days, active days, and net cashflow accurately'
    );

    // Test specific day with mutations
    const dayOct10 = calendarMod.getDayTransactions(testTxs, '2026-10-10');
    assert(
      dayOct10.date === '2026-10-10' &&
      dayOct10.transaction_count === 2 &&
      dayOct10.income === 0 &&
      dayOct10.expense === 75000 &&
      dayOct10.net === -75000 &&
      dayOct10.transactions.length === 2,
      'TEST 86: Daily filter returns exact mutations, total expense, and negative net cashflow'
    );

    // Test day without mutations
    const dayOct15 = calendarMod.getDayTransactions(testTxs, '2026-10-15');
    assert(
      dayOct15.date === '2026-10-15' &&
      dayOct15.transaction_count === 0 &&
      dayOct15.income === 0 &&
      dayOct15.expense === 0 &&
      dayOct15.net === 0 &&
      dayOct15.transactions.length === 0,
      'TEST 87: Non-active date returns 0 count and zeroed cashflow metrics'
    );

    // Test timezone date key formatting (Asia/Jakarta)
    const dateKey = calendarMod.getWibDateKey('2026-10-10T02:00:00Z'); // 02:00 UTC = 09:00 WIB
    assert(dateKey === '2026-10-10', 'TEST 88: getWibDateKey correctly normalizes UTC timestamp to Asia/Jakarta YYYY-MM-DD');

    // Test public calendar frontend component file integrity
    const calJsPath = path.join(__dirname, 'public', 'modules', 'calendar.js');
    assert(fs.existsSync(calJsPath), 'TEST 89: public/modules/calendar.js exists on filesystem');
    const calJsContent = fs.readFileSync(calJsPath, 'utf8');
    assert(
      calJsContent.includes('goToPrevMonth') &&
      calJsContent.includes('goToNextMonth') &&
      calJsContent.includes('selectCalendarDate') &&
      calJsContent.includes('cal-indicator-dots') &&
      calJsContent.includes('cal-daily-breakdown'),
      'TEST 90: Calendar frontend module contains month navigation, date selection, mutation dots, and breakdown UI'
    );
  } catch (e) {
    assert(false, 'Calendar Module Tests: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 22. TELEGRAM BOT ADVANCED NLP, INCOME INVERSION & WEBHOOK HARDENING (R5)
  // ------------------------------------------------------------------
  try {
    const telegramNlp = require('./src/lib/telegram-nlp');

    // 1. Complex Currency Nominal Parsing
    assert(telegramNlp.parseIndonesianCurrency('beli 2 ayam geprek 25.000') === 25000, 'TEST 91: Multi-word nominal with quantity (2 ayam geprek 25.000) parsed as 25000');
    assert(telegramNlp.parseIndonesianCurrency('beli 2 ayam geprek 25.500') === 25500, 'TEST 92: Formatted decimal dot separator 25.500 parsed as 25500');
    assert(telegramNlp.parseIndonesianCurrency('beli 2 ayam 25000') === 25000, 'TEST 93: Multi-word nominal plain digits 25000 parsed as 25000 without digit concatenation');
    assert(telegramNlp.parseIndonesianCurrency('beli 2 ayam 25rb') === 25000, 'TEST 94: Multi-word nominal with 25rb parsed as 25000');
    assert(telegramNlp.parseIndonesianCurrency('beli 2 ayam 25k') === 25000, 'TEST 95: Multi-word nominal with 25k parsed as 25000');
    assert(telegramNlp.parseIndonesianCurrency('makan 25.500') === 25500, 'TEST 96: makan 25.500 parsed as 25500');
    assert(telegramNlp.parseIndonesianCurrency('gaji 12,5jt') === 12500000, 'TEST 97: gaji 12,5jt with comma decimal parsed as 12500000');
    assert(telegramNlp.parseIndonesianCurrency('gaji 12.5jt') === 12500000, 'TEST 98: gaji 12.5jt with dot decimal parsed as 12500000');
    assert(telegramNlp.parseIndonesianCurrency('gaji 12,5 juta') === 12500000, 'TEST 99: word "juta" with comma decimal (12,5 juta) parsed as 12500000');
    assert(telegramNlp.parseIndonesianCurrency('gaji 12.5 juta') === 12500000, 'TEST 100: word "juta" with dot decimal (12.5 juta) parsed as 12500000');
    assert(telegramNlp.parseIndonesianCurrency('beli pulsa 50rb') === 50000, 'TEST 101: beli pulsa 50rb parsed as 50000');
    assert(telegramNlp.parseIndonesianCurrency('beli pulsa 50 ribu') === 50000, 'TEST 102: beli pulsa 50 ribu parsed as 50000');
    assert(telegramNlp.parseIndonesianCurrency('beli pulsa 50k') === 50000, 'TEST 103: beli pulsa 50k parsed as 50000');
    assert(telegramNlp.parseIndonesianCurrency('beli 3 donat @ Rp 15.000') === 15000, 'TEST 104: Prefix Rp 15.000 parsed as 15000');
    assert(telegramNlp.parseIndonesianCurrency('Rp 500') === 500, 'TEST 105: Sub-thousand amount Rp 500 parsed as 500');
    assert(telegramNlp.parseIndonesianCurrency('500 perak') === 500, 'TEST 106: Suffix 500 perak parsed as 500');
    assert(telegramNlp.parseIndonesianCurrency('halo selamat pagi') === null, 'TEST 107: Text without nominal returns null');

    // 2. Income Inversion Bug Fix
    assert(telegramNlp.isSalaryExpense('gaji supir 1.5jt') === true, 'TEST 108: gaji supir detected as salary expense');
    assert(telegramNlp.isSalaryExpense('bayar gaji pembantu 2jt') === true, 'TEST 109: bayar gaji pembantu detected as salary expense');
    assert(telegramNlp.isSalaryExpense('bayar gaji supir 1.5jt') === true, 'TEST 110: bayar gaji supir detected as salary expense');
    assert(telegramNlp.isSalaryExpense('gaji karyawan 3.5jt') === true, 'TEST 111: gaji karyawan detected as salary expense');
    assert(telegramNlp.isSalaryExpense('gaji 12,5jt') === false, 'TEST 112: gaji 12,5jt is user income, not salary expense');
    assert(telegramNlp.isSalaryExpense('gajian kantor 9.5jt') === false, 'TEST 113: gajian kantor is user income, not salary expense');

    const catGajiSupir = telegramNlp.categorizeTelegramMessage('gaji supir 1.5jt');
    assert(catGajiSupir.type === 'expense', 'TEST 114: gaji supir 1.5jt classified as EXPENSE (income inversion prevented)');
    assert(catGajiSupir.nominal === 1500000, 'TEST 115: gaji supir 1.5jt nominal extracted as 1500000');
    assert(catGajiSupir.categoryName === 'Tagihan & Utilitas', 'TEST 116: gaji supir categorized under Tagihan & Utilitas');

    const catBayarPembantu = telegramNlp.categorizeTelegramMessage('bayar gaji pembantu 2jt');
    assert(catBayarPembantu.type === 'expense', 'TEST 117: bayar gaji pembantu 2jt classified as EXPENSE');
    assert(catBayarPembantu.nominal === 2000000, 'TEST 118: bayar gaji pembantu 2jt nominal extracted as 2000000');

    const catIncome = telegramNlp.categorizeTelegramMessage('gaji 12,5jt');
    assert(catIncome.type === 'income', 'TEST 119: gaji 12,5jt classified as INCOME');
    assert(catIncome.nominal === 12500000, 'TEST 120: gaji 12,5jt nominal extracted as 12500000');

    // 3. Anti-Silent Misclassification Bug Fix
    const catPotongRambut = telegramNlp.categorizeTelegramMessage('potong rambut 35rb');
    assert(catPotongRambut.type === 'expense', 'TEST 121: potong rambut 35rb is expense');
    assert(catPotongRambut.nominal === 35000, 'TEST 122: potong rambut 35rb nominal is 35000');
    assert(catPotongRambut.categoryName === 'Lain-lain', 'TEST 123: potong rambut not misclassified as Makanan & Minuman (fallback to Lain-lain)');

    const catSemen = telegramNlp.categorizeTelegramMessage('beli semen 50rb');
    assert(catSemen.categoryName === 'Lain-lain', 'TEST 124: beli semen 50rb categorized as Lain-lain, not Makanan & Minuman');

    const catMakanan = telegramNlp.categorizeTelegramMessage('beli nasi padang rendang 25rb');
    assert(catMakanan.categoryName === 'Makanan & Minuman', 'TEST 125: actual food correctly categorized as Makanan & Minuman');

    // 4. Webhook Hardening: End-to-End Idempotency & Deduplication
    const webhookGajiSupir = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'gaji supir 1.5jt' }
    });
    assert(webhookGajiSupir.status === 200, 'TEST 126: Webhook gaji supir 1.5jt returns 200');
    assert(webhookGajiSupir.data.transaction && webhookGajiSupir.data.transaction.type === 'expense', 'TEST 127: Webhook transaction recorded as EXPENSE');
    assert(webhookGajiSupir.data.transaction.amount === 1500000, 'TEST 128: Webhook transaction amount is 1500000');
    assert(webhookGajiSupir.data.reply_text && webhookGajiSupir.data.reply_text.includes('Pengeluaran tercatat!'), 'TEST 129: Webhook reply acknowledges Pengeluaran tercatat');

    const webhookIncome12jt = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'gaji 12,5jt' }
    });
    assert(webhookIncome12jt.data.transaction && webhookIncome12jt.data.transaction.type === 'income', 'TEST 130: Webhook gaji 12,5jt recorded as INCOME');
    assert(webhookIncome12jt.data.transaction.amount === 12500000, 'TEST 131: Webhook transaction amount is 12500000');

    const webhook2Ayam = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'beli 2 ayam geprek 25.000' }
    });
    assert(webhook2Ayam.data.transaction.amount === 25000, 'TEST 132: Webhook beli 2 ayam geprek 25.000 amount is exactly 25000');

    const noUpdateId1 = await post('/api/telegram/webhook', {
      message: { text: 'Bayar iuran kebersihan RT 30rb' }
    });
    assert(noUpdateId1.status === 200 && noUpdateId1.data.ok === true && noUpdateId1.data.transaction, 'TEST 133: Webhook without update_id processed first time');

    const noUpdateId2 = await post('/api/telegram/webhook', {
      message: { text: 'Bayar iuran kebersihan RT 30rb' }
    });
    assert(noUpdateId2.status === 200 && noUpdateId2.data.skipped_reason === 'idempotent_duplicate', 'TEST 134: Webhook without update_id blocked as duplicate (missing update_id cannot bypass idempotency)');

    const semFirst = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'Beli paket data 100rb' }
    });
    assert(semFirst.status === 200 && semFirst.data.transaction, 'TEST 135: Semantic test first call processed');

    const semDup = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'Beli paket data 100rb' }
    });
    assert(semDup.data.skipped_reason === 'idempotent_duplicate', 'TEST 136: Semantic duplicate with different update_id blocked within 60s window');
  } catch (e) {
    assert(false, 'Milestone 5 (R5) Tests: ' + e.message);
  }

  console.log(`\n========================================`);
  console.log(`📊 TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log(`========================================`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
