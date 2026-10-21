// ====================================================================
// Test Suite: Milestone 1 Admin Approval System (R1) Verification
// Tests Unit Logic (src/modules/admin-approval.js) & HTTP Endpoints
// ====================================================================

const http = require('http');
const path = require('path');
const adminApproval = require('./src/modules/admin-approval');

function post(endpoint, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data || {});
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
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

function get(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${endpoint}`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch (e) { parsed = { raw: body }; }
        resolve({ status: res.statusCode, data: parsed, body });
      });
    }).on('error', reject);
  });
}

function createMockDb() {
  return {
    user: { id: 'usr_mock_001', full_name: 'Mock User', role: 'user' },
    allUsers: [
      { id: 'usr_mock_001', full_name: 'Mock User', plan: 'starter' },
      { id: 'usr_mock_002', full_name: 'Second User', plan: 'starter' }
    ],
    wallets: [
      { id: 'wal_mock_bca', name: 'BCA Utama', balance: 5000000 }
    ],
    categories: [
      { id: 'cat_hiburan', name: 'Hiburan', type: 'expense' }
    ],
    budgets: [
      { id: 'bud_hiburan', category_id: 'cat_hiburan', category_name: 'Hiburan', monthly_limit: 800000 }
    ],
    transactions: [],
    payments: [
      { id: 'pay_mock_01', user_name: 'Second User', plan: 'pro', status: 'pending' }
    ],
    approvals: [
      {
        id: 'appr_pending_1',
        user_id: 'usr_mock_002',
        user_name: 'Second User',
        category: 'plan_upgrade',
        title: 'Upgrade Pro',
        amount: 99000,
        details: { plan: 'pro', payment_id: 'pay_mock_01' },
        status: 'pending',
        admin_notes: null
      },
      {
        id: 'appr_pending_2',
        user_id: 'usr_mock_001',
        user_name: 'Mock User',
        category: 'wallet_topup',
        title: 'Topup Saldo BCA',
        amount: 1000000,
        details: { wallet_id: 'wal_mock_bca', amount: 1000000, type: 'credit' },
        status: 'pending',
        admin_notes: null
      },
      {
        id: 'appr_pending_3',
        user_id: 'usr_mock_001',
        user_name: 'Mock User',
        category: 'budget_custom',
        title: 'Naikkan Limit Hiburan',
        amount: 1500000,
        details: { budget_id: 'bud_hiburan', category_name: 'Hiburan', requested_limit: 1500000 },
        status: 'pending',
        admin_notes: null
      },
      {
        id: 'appr_approved_1',
        user_id: 'usr_mock_001',
        user_name: 'Mock User',
        category: 'plan_upgrade',
        title: 'Sudah Disetujui',
        amount: 99000,
        status: 'approved',
        admin_notes: 'Valid'
      },
      {
        id: 'appr_rejected_1',
        user_id: 'usr_mock_001',
        user_name: 'Mock User',
        category: 'wallet_topup',
        title: 'Sudah Ditolak',
        amount: 500000,
        status: 'rejected',
        admin_notes: 'Nota fiktif'
      }
    ],
    auditLogs: [],
    subscription: { plan: 'starter' }
  };
}

async function runAllTests() {
  console.log('🧪 RUNNING TATADANA MILESTONE 1 (R1) ADMIN APPROVAL VERIFICATION...\n');
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

  // ====================================================================
  // PART 1: MODULE UNIT TESTS (src/modules/admin-approval.js)
  // ====================================================================
  console.log('--- PART 1: MODULE UNIT TESTS ---');

  const mockDb = createMockDb();

  // 1. Filter all
  const allFiltered = adminApproval.filterApprovals(mockDb.approvals);
  assert(allFiltered.length === 5, 'Unit 1: filterApprovals without filter returns all');

  // 2. Filter status pending
  const pendingFiltered = adminApproval.filterApprovals(mockDb.approvals, { status: 'pending' });
  assert(pendingFiltered.length === 3 && pendingFiltered.every(a => a.status === 'pending'), 'Unit 2: filterApprovals with status: pending');

  // 3. Filter status Pending (case-insensitive)
  const pendingCaseFiltered = adminApproval.filterApprovals(mockDb.approvals, { status: 'Pending' });
  assert(pendingCaseFiltered.length === 3 && pendingCaseFiltered.every(a => a.status === 'pending'), 'Unit 3: filterApprovals with status: Pending (case-insensitive)');

  // 4. Filter status approved / Approved
  const approvedFiltered = adminApproval.filterApprovals(mockDb.approvals, { status: 'Approved' });
  assert(approvedFiltered.length === 1 && approvedFiltered[0].status === 'approved', 'Unit 4: filterApprovals with status: Approved');

  // 5. Filter status rejected / Rejected
  const rejectedFiltered = adminApproval.filterApprovals(mockDb.approvals, { status: 'Rejected' });
  assert(rejectedFiltered.length === 1 && rejectedFiltered[0].status === 'rejected', 'Unit 5: filterApprovals with status: Rejected');

  // 6. Filter category
  const catFiltered = adminApproval.filterApprovals(mockDb.approvals, { category: 'plan_upgrade' });
  assert(catFiltered.length === 2 && catFiltered.every(a => a.category === 'plan_upgrade'), 'Unit 6: filterApprovals with category: plan_upgrade');

  // 7. Create approval request
  const createdRes = adminApproval.createApprovalRequest(mockDb, {
    user_id: 'usr_mock_001',
    user_name: 'Mock User',
    category: 'wallet_topup',
    title: 'Topup Dompet Baru',
    amount: 250000
  });
  assert(createdRes.ok === true && createdRes.approval.status === 'pending' && createdRes.approval.amount === 250000, 'Unit 7: createApprovalRequest valid creation');

  // 8. Create approval request with invalid category
  const invalidCatRes = adminApproval.createApprovalRequest(mockDb, {
    category: 'invalid_category_xyz',
    amount: 10000
  });
  assert(invalidCatRes.ok === false && invalidCatRes.status === 400, 'Unit 8: createApprovalRequest rejects invalid category with 400');

  // 9. Create approval request with negative amount
  const negAmtRes = adminApproval.createApprovalRequest(mockDb, {
    category: 'wallet_topup',
    amount: -5000
  });
  assert(negAmtRes.ok === false && negAmtRes.status === 400, 'Unit 9: createApprovalRequest rejects negative amount with 400');

  // 10. Approve Plan Upgrade: updates targetUser.plan, linked payment, and auditLog
  const apprPlanRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: 'appr_pending_1',
    action: 'approve',
    reason: 'Pembayaran terkonfirmasi'
  });
  assert(apprPlanRes.ok === true && apprPlanRes.approval.status === 'approved', 'Unit 10: processApprovalAction approves plan_upgrade');
  assert(mockDb.allUsers.find(u => u.id === 'usr_mock_002').plan === 'pro', 'Unit 10b: target user plan upgraded to pro');
  assert(mockDb.payments.find(p => p.id === 'pay_mock_01').status === 'approved', 'Unit 10c: linked payment status updated to approved');
  assert(mockDb.auditLogs.some(l => l.action === 'approve_plan_upgrade'), 'Unit 10d: audit log recorded for plan upgrade approval');

  // 11. Approve Wallet Topup (credit): updates wallet balance and creates transaction & auditLog
  const balBefore = mockDb.wallets[0].balance;
  const apprWalletRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: 'appr_pending_2',
    action: 'approve',
    reason: 'Transfer disetujui'
  });
  assert(apprWalletRes.ok === true && apprWalletRes.approval.status === 'approved', 'Unit 11: processApprovalAction approves wallet_topup');
  assert(mockDb.wallets[0].balance === balBefore + 1000000, 'Unit 11b: wallet balance credited by 1.000.000');
  assert(mockDb.transactions.some(t => t.amount === 1000000 && t.type === 'income'), 'Unit 11c: transaction record created');
  assert(mockDb.auditLogs.some(l => l.action === 'approve_wallet_topup'), 'Unit 11d: audit log recorded for wallet topup');

  // 12. Approve Wallet Debit adjustment
  const debitAppr = adminApproval.createApprovalRequest(mockDb, {
    category: 'wallet_topup',
    title: 'Koreksi Debit',
    amount: 200000,
    details: { wallet_id: 'wal_mock_bca', type: 'debit', amount: 200000 }
  });
  const balBeforeDebit = mockDb.wallets[0].balance;
  const apprDebitRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: debitAppr.approval.id,
    action: 'approve',
    reason: 'Koreksi debit'
  });
  assert(apprDebitRes.ok === true && mockDb.wallets[0].balance === balBeforeDebit - 200000, 'Unit 12: wallet debit adjustment decreases balance');

  // 13. Approve Budget Custom Limit
  const apprBudRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: 'appr_pending_3',
    action: 'approve',
    reason: 'Limit disetujui'
  });
  assert(apprBudRes.ok === true && mockDb.budgets[0].monthly_limit === 1500000, 'Unit 13: budget monthly_limit updated to 1.500.000');
  assert(mockDb.auditLogs.some(l => l.action === 'approve_budget_limit'), 'Unit 13b: audit log recorded for budget limit expansion');

  // 14. Rejection WITHOUT reason/note: MUST return 400
  const pendingForReject = adminApproval.createApprovalRequest(mockDb, {
    category: 'wallet_topup',
    title: 'Permintaan Ditolak Uji',
    amount: 300000
  });
  const rejectNoReasonRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: pendingForReject.approval.id,
    action: 'reject'
  });
  assert(rejectNoReasonRes.ok === false && rejectNoReasonRes.status === 400, 'Unit 14: Rejection without reason fails with HTTP 400');

  // 15. Rejection with whitespace-only reason: MUST return 400
  const rejectWhitespaceRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: pendingForReject.approval.id,
    action: 'reject',
    reason: '    '
  });
  assert(rejectWhitespaceRes.ok === false && rejectWhitespaceRes.status === 400, 'Unit 15: Rejection with whitespace reason fails with HTTP 400');

  // 16. Rejection WITH valid reason: MUST succeed with status 'rejected'
  const balBeforeRej = mockDb.wallets[0].balance;
  const userPlanBeforeRej = mockDb.allUsers[0].plan;
  const rejectValidRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: pendingForReject.approval.id,
    action: 'reject',
    reason: 'Struk tidak valid dan kabur'
  });
  assert(rejectValidRes.ok === true && rejectValidRes.approval.status === 'rejected', 'Unit 16: Rejection with reason succeeds and sets status rejected');
  assert(rejectValidRes.approval.admin_notes === 'Struk tidak valid dan kabur', 'Unit 16b: Rejection reason stored in admin_notes');

  // 17. Rejection does NOT modify wallet balance or user plan
  assert(mockDb.wallets[0].balance === balBeforeRej, 'Unit 17a: Rejection does NOT change wallet balance');
  assert(mockDb.allUsers[0].plan === userPlanBeforeRej, 'Unit 17b: Rejection does NOT change user plan');
  assert(mockDb.auditLogs.some(l => l.action === 'reject_wallet_topup' && l.details.reason === 'Struk tidak valid dan kabur'), 'Unit 17c: Rejection audit log recorded with reason');

  // 18. Re-approval of already approved item: MUST return 400 (Double spending / state machine protection)
  const doubleApproveRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: 'appr_approved_1',
    action: 'approve',
    reason: 'Mencoba approve ulang'
  });
  assert(doubleApproveRes.ok === false && doubleApproveRes.status === 400, 'Unit 18: Re-approval of approved item rejected with 400');

  // 19. Re-rejection of already approved item: MUST return 400
  const reRejectApprovedRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: 'appr_approved_1',
    action: 'reject',
    reason: 'Mencoba reject item approved'
  });
  assert(reRejectApprovedRes.ok === false && reRejectApprovedRes.status === 400, 'Unit 19: Re-reject of approved item rejected with 400');

  // 20. Re-processing of already rejected item: MUST return 400
  const reProcessRejectRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: 'appr_rejected_1',
    action: 'approve',
    reason: 'Mencoba approve item rejected'
  });
  assert(reProcessRejectRes.ok === false && reProcessRejectRes.status === 400, 'Unit 20: Re-processing of rejected item rejected with 400');

  // 21. Non-existent approval ID: returns 404
  const notFoundRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: 'appr_non_existent_9999',
    action: 'approve'
  });
  assert(notFoundRes.ok === false && notFoundRes.status === 404, 'Unit 21: Non-existent ID returns 404');

  // 22. Invalid action parameter: returns 400
  const testPending = adminApproval.createApprovalRequest(mockDb, { category: 'wallet_topup', amount: 10000 });
  const badActionRes = adminApproval.processApprovalAction(mockDb, {
    approvalId: testPending.approval.id,
    action: 'hold'
  });
  assert(badActionRes.ok === false && badActionRes.status === 400, 'Unit 22: Invalid action parameter returns 400');

  // 23. Parameter alias compatibility ({ id, note })
  const aliasPending = adminApproval.createApprovalRequest(mockDb, { category: 'wallet_topup', amount: 50000 });
  const aliasRes = adminApproval.processApprovalAction(mockDb, {
    id: aliasPending.approval.id,
    action: 'reject',
    note: 'Ditolak via alias note'
  });
  assert(aliasRes.ok === true && aliasRes.approval.admin_notes === 'Ditolak via alias note', 'Unit 23: Parameter alias { id, note } supported');

  // ====================================================================
  // PART 2: HTTP INTEGRATION TESTS (http://localhost:3000)
  // ====================================================================
  console.log('\n--- PART 2: HTTP INTEGRATION TESTS ---');

  // Auto-start server if not already running
  try {
    await get('/api/state');
  } catch (e) {
    require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  // Reset server state
  try {
    await post('/api/test/reset-state');
  } catch (e) {
    console.warn('Reset state notice:', e.message);
  }

  // HTTP 1: GET /api/admin/approvals
  const httpApprRes = await get('/api/admin/approvals');
  assert(httpApprRes.status === 200 && httpApprRes.data.ok === true && Array.isArray(httpApprRes.data.approvals), 'HTTP 1: GET /api/admin/approvals returns 200 and list');

  // HTTP 2: Filter ?status=pending
  const httpPendRes = await get('/api/admin/approvals?status=pending');
  assert(httpPendRes.status === 200 && httpPendRes.data.approvals.every(a => a.status === 'pending'), 'HTTP 2: GET /api/admin/approvals?status=pending returns pending list');

  // HTTP 3: Filter ?status=Pending (case-insensitive)
  const httpPendCaseRes = await get('/api/admin/approvals?status=Pending');
  assert(httpPendCaseRes.status === 200 && httpPendCaseRes.data.approvals.every(a => a.status === 'pending'), 'HTTP 3: GET /api/admin/approvals?status=Pending returns pending list');

  // HTTP 4: Filter ?status=approved / Approved
  const httpApprCaseRes = await get('/api/admin/approvals?status=Approved');
  assert(httpApprCaseRes.status === 200 && httpApprCaseRes.data.approvals.every(a => a.status === 'approved'), 'HTTP 4: GET /api/admin/approvals?status=Approved returns approved list');

  // HTTP 5: Filter ?status=rejected / Rejected
  const httpRejCaseRes = await get('/api/admin/approvals?status=Rejected');
  assert(httpRejCaseRes.status === 200 && httpRejCaseRes.data.approvals.every(a => a.status === 'rejected'), 'HTTP 5: GET /api/admin/approvals?status=Rejected returns rejected list');

  // HTTP 6: Create new approval request via HTTP
  const httpCreateRes = await post('/api/admin/approvals', {
    user_id: 'usr_tatadana_001',
    user_name: 'Budi Pratama',
    category: 'wallet_topup',
    title: 'Topup Tes Rejection Verification',
    amount: 150000,
    description: 'Permintaan untuk verifikasi penolakan berbayar'
  });
  assert(httpCreateRes.status === 201 && httpCreateRes.data.ok === true && httpCreateRes.data.approval.status === 'pending', 'HTTP 6: POST /api/admin/approvals creates pending request');

  const testApprId = httpCreateRes.data.approval.id;

  // HTTP 7: Reject without reason via HTTP -> 400
  const httpRejectNoReason = await post('/api/admin/approvals/action', {
    approvalId: testApprId,
    action: 'reject'
  });
  assert(httpRejectNoReason.status === 400 && httpRejectNoReason.data.ok === false, 'HTTP 7: POST /api/admin/approvals/action reject without reason returns 400');

  // HTTP 8: Reject with whitespace reason via HTTP -> 400
  const httpRejectWhitespace = await post('/api/admin/approvals/action', {
    approvalId: testApprId,
    action: 'reject',
    reason: '   '
  });
  assert(httpRejectWhitespace.status === 400 && httpRejectWhitespace.data.ok === false, 'HTTP 8: POST /api/admin/approvals/action reject with whitespace reason returns 400');

  // Record state before rejection
  const stateBeforeReject = JSON.parse((await get('/api/state')).body);
  const bcaBalBeforeReject = stateBeforeReject.wallets.find(w => w.id === 'wal_bca').balance;
  const userPlanBeforeReject = stateBeforeReject.user.role;

  // HTTP 9: Reject with valid reason via HTTP -> 200
  const httpRejectValid = await post('/api/admin/approvals/action', {
    approvalId: testApprId,
    action: 'reject',
    reason: 'Bukti transfer tidak valid dari bank penerima'
  });
  assert(httpRejectValid.status === 200 && httpRejectValid.data.approval.status === 'rejected', 'HTTP 9: POST /api/admin/approvals/action reject with reason returns 200 and status rejected');
  assert(httpRejectValid.data.approval.admin_notes === 'Bukti transfer tidak valid dari bank penerima', 'HTTP 9b: Rejection reason correctly persisted');

  // HTTP 10: State after rejection: saldo dompet dan paket user tidak berubah
  const stateAfterReject = JSON.parse((await get('/api/state')).body);
  const bcaBalAfterReject = stateAfterReject.wallets.find(w => w.id === 'wal_bca').balance;
  const userPlanAfterReject = stateAfterReject.user.role;
  assert(bcaBalAfterReject === bcaBalBeforeReject, 'HTTP 10a: User wallet balance strictly unchanged after rejection');
  assert(userPlanAfterReject === userPlanBeforeReject, 'HTTP 10b: User plan/role strictly unchanged after rejection');

  // HTTP 11: Re-processing rejected request via HTTP -> 400
  const httpReProcessReject = await post('/api/admin/approvals/action', {
    approvalId: testApprId,
    action: 'approve',
    reason: 'Mencoba menyetujui yang sudah ditolak'
  });
  assert(httpReProcessReject.status === 400 && httpReProcessReject.data.ok === false, 'HTTP 11: Re-processing already rejected request returns 400');

  // HTTP 12: Create request to test approval flow
  const httpCreateForApprove = await post('/api/admin/approvals', {
    user_id: 'usr_tatadana_001',
    user_name: 'Budi Pratama',
    category: 'wallet_topup',
    title: 'Topup Tes Approval Verification',
    amount: 500000,
    details: { wallet_id: 'wal_bca', amount: 500000, type: 'credit' }
  });
  assert(httpCreateForApprove.status === 201 && httpCreateForApprove.data.ok === true, 'HTTP 12: Created request for approval test');
  const approveTargetId = httpCreateForApprove.data.approval.id;

  const bcaBeforeApprove = (JSON.parse((await get('/api/state')).body)).wallets.find(w => w.id === 'wal_bca').balance;

  // HTTP 13: Approve via HTTP -> 200, balance updated immediately
  const httpApproveRes = await post('/api/admin/approvals/action', {
    approvalId: approveTargetId,
    action: 'approve',
    reason: 'Topup berhasil diverifikasi oleh Admin'
  });
  assert(httpApproveRes.status === 200 && httpApproveRes.data.approval.status === 'approved', 'HTTP 13: POST /api/admin/approvals/action approve returns 200 and status approved');

  const bcaAfterApprove = (JSON.parse((await get('/api/state')).body)).wallets.find(w => w.id === 'wal_bca').balance;
  assert(bcaAfterApprove === bcaBeforeApprove + 500000, 'HTTP 13b: Wallet balance increased immediately by 500.000 in real-time');

  // HTTP 14: Re-approving already approved item via HTTP -> 400
  const httpReApproveRes = await post('/api/admin/approvals/action', {
    approvalId: approveTargetId,
    action: 'approve',
    reason: 'Mencoba menyetujui ulang'
  });
  assert(httpReApproveRes.status === 400 && httpReApproveRes.data.ok === false, 'HTTP 14: Re-approving already approved request returns 400');

  // HTTP 15: Check audit logs via /api/admin/audit-logs
  const auditRes = await get('/api/admin/audit-logs');
  assert(auditRes.status === 200 && auditRes.data.ok === true, 'HTTP 15: GET /api/admin/audit-logs returns 200');
  const auditLogs = auditRes.data.auditLogs || [];
  const foundRejectLog = auditLogs.find(l => l.action === 'reject_wallet_topup' && l.details?.approval_id === testApprId);
  const foundApproveLog = auditLogs.find(l => l.action === 'approve_wallet_topup' && l.details?.approval_id === approveTargetId);
  assert(foundRejectLog !== undefined, 'HTTP 15b: Audit log contains rejection record with mandatory reason');
  assert(foundApproveLog !== undefined, 'HTTP 15c: Audit log contains approval record with real-time detail');

  console.log(`\n======================================================`);
  console.log(`📊 MILESTONE 1 VERIFICATION: ${passed} / ${total} TESTS PASSED`);
  console.log(`======================================================`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
