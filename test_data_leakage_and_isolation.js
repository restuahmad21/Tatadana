// test_data_leakage_and_isolation.js
// Verification suite for multi-tenant data isolation, empty states, and admin global stats

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };
    let bodyData = null;
    if (body) {
      bodyData = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
    }
    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });
    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 ====================================================');
  console.log('🧪 RUNNING DATA LEAKAGE & ISOLATION VERIFICATION SUITE');
  console.log('🧪 ====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (details) console.error(`     Details: ${details}`);
      failed++;
    }
  }

  try {
    // Auto-start server if not already running
    try {
      await request('GET', '/api/state');
    } catch (e) {
      require('./server.js');
      await new Promise(r => setTimeout(r, 600));
    }

    // ---------------------------------------------------------
    // Test 1: User A vs User B Isolation on GET /api/state
    // ---------------------------------------------------------
    console.log('--- Test Suite 1: Multi-Tenant Data Isolation ---');
    const userAState = await request('GET', '/api/state?userId=usr_tatadana_001');
    assert(userAState.status === 200, 'GET /api/state for User A succeeds');
    const userAWallets = userAState.data.wallets || [];
    const userATxs = userAState.data.transactions || [];
    assert(userAWallets.length > 0, 'User A has seeded wallets');
    assert(userAWallets.every(w => w.user_id === 'usr_tatadana_001'), 'All User A wallets strictly belong to usr_tatadana_001');
    assert(userATxs.every(tx => tx.user_id === 'usr_tatadana_001'), 'All User A transactions strictly belong to usr_tatadana_001');

    // Ahmad (User 3)
    const userBState = await request('GET', '/api/state?userId=usr_tatadana_003');
    assert(userBState.status === 200, 'GET /api/state for User B (Ahmad) succeeds');
    const userBWallets = userBState.data.wallets || [];
    const userBTxs = userBState.data.transactions || [];
    assert(userBWallets.every(w => w.user_id === 'usr_tatadana_003'), 'User B wallets strictly belong to usr_tatadana_003');
    assert(userBWallets.every(w => !userAWallets.some(aw => aw.id === w.id)), 'No wallet ID overlap between User A and User B');
    assert(userBTxs.every(tx => tx.user_id === 'usr_tatadana_003'), 'User B transactions strictly belong to usr_tatadana_003');

    // ---------------------------------------------------------
    // Test 2: Empty State for Newly Registered User
    // ---------------------------------------------------------
    console.log('\n--- Test Suite 2: Empty State for New User ---');
    const uniqueEmail = `newuser_${Date.now()}@example.com`;
    const regRes = await request('POST', '/api/auth/register', {
      name: 'User Baru Bersih',
      email: uniqueEmail,
      password: 'Password123!',
      phoneNumber: '0812' + Math.floor(10000000 + Math.random() * 90000000)
    });
    assert(regRes.status === 200 && regRes.data.ok, 'Register new clean user succeeds');
    const newUserId = regRes.data.user.id;

    const newState = await request('GET', `/api/state?userId=${newUserId}`);
    assert(newState.status === 200, 'GET /api/state for new user succeeds');
    const newUserData = newState.data;
    
    assert(newUserData.wallets.length === 0, 'New user starts with 0 wallets (empty state)', `Got ${newUserData.wallets.length}`);
    assert(newUserData.transactions.length === 0, 'New user starts with 0 transactions (empty state)', `Got ${newUserData.transactions.length}`);
    assert(newUserData.budgets.length === 0, 'New user starts with 0 budgets (empty state)', `Got ${newUserData.budgets.length}`);
    assert(newUserData.calendarNotes.length === 0, 'New user starts with 0 calendar notes', `Got ${newUserData.calendarNotes.length}`);
    
    // Check computed total balance for new user
    const totalBalance = newUserData.wallets.reduce((acc, w) => acc + (w.balance || 0), 0);
    assert(totalBalance === 0, 'New user total balance is exactly Rp0', `Got ${totalBalance}`);

    // Check profile fields are clean
    assert(!newUserData.user.job_profile || newUserData.user.job_profile === '', 'New user job profile is empty');
    assert(!newUserData.user.bio || newUserData.user.bio === '', 'New user bio is empty');

    // ---------------------------------------------------------
    // Test 3: Admin Personal Financial Dashboard Starts at Rp0
    // ---------------------------------------------------------
    console.log('\n--- Test Suite 3: Admin Personal Financial Isolation ---');
    const adminState = await request('GET', '/api/state?userId=usr_admin_001');
    assert(adminState.status === 200, 'GET /api/state for Admin user succeeds');
    const adminData = adminState.data;
    assert(adminData.user.role === 'admin', 'Admin user role is verified as admin');
    assert(adminData.wallets.length === 0, 'Admin personal wallets start at 0 (clean personal financial dashboard)', `Got ${adminData.wallets.length}`);
    assert(adminData.transactions.length === 0, 'Admin personal transactions start at 0', `Got ${adminData.transactions.length}`);
    const adminTotalBalance = adminData.wallets.reduce((acc, w) => acc + (w.balance || 0), 0);
    assert(adminTotalBalance === 0, 'Admin personal balance starts at Rp0', `Got ${adminTotalBalance}`);

    // ---------------------------------------------------------
    // Test 4: Admin Global Statistics (Synchronized Across All Users)
    // ---------------------------------------------------------
    console.log('\n--- Test Suite 4: Admin Global Platform Statistics ---');
    // Non-admin check (must be rejected)
    const nonAdminStats = await request('GET', `/api/admin/global-stats?userId=${newUserId}`);
    assert(nonAdminStats.status === 403, 'Non-admin request to /api/admin/global-stats rejected with 403 Forbidden');

    // Admin access
    const adminGlobalStats = await request('GET', '/api/admin/global-stats?userId=usr_admin_001');
    assert(adminGlobalStats.status === 200 && adminGlobalStats.data.ok, 'Admin successfully retrieves global platform statistics');
    const stats = adminGlobalStats.data.stats;
    assert(typeof stats.total_users === 'number' && stats.total_users > 0, `Global total_users is positive (${stats.total_users})`);
    assert(typeof stats.active_users === 'number' && stats.active_users > 0, `Global active_users is positive (${stats.active_users})`);
    assert(typeof stats.total_system_balance === 'number' && stats.total_system_balance > 0, `Global total_system_balance aggregates across users (${stats.total_system_balance})`);
    assert(typeof stats.total_transactions === 'number' && stats.total_transactions > 0, `Global total_transactions is positive (${stats.total_transactions})`);
    assert(typeof stats.total_income === 'number', `Global total_income present (${stats.total_income})`);
    assert(typeof stats.total_expense === 'number', `Global total_expense present (${stats.total_expense})`);
    assert(stats.net_cashflow === (stats.total_income - stats.total_expense), 'Net cashflow equals total_income - total_expense');

    // ---------------------------------------------------------
    // Test 5: Admin Inspect User Financials & Audit Log
    // ---------------------------------------------------------
    console.log('\n--- Test Suite 5: Admin User Financial Inspection & Audit Trail ---');
    // Non-admin cannot inspect
    const nonAdminInspect = await request('GET', `/api/admin/users/usr_tatadana_001/financials?callerId=${newUserId}`);
    assert(nonAdminInspect.status === 403, 'Non-admin cannot inspect other user financials (403)');

    // Admin inspects User A (Rian)
    const inspectRes = await request('GET', '/api/admin/users/usr_tatadana_001/financials?callerId=usr_admin_001');
    assert(inspectRes.status === 200 && inspectRes.data.ok, 'Admin inspects User A financial details');
    const finData = inspectRes.data;
    assert(finData.user.id === 'usr_tatadana_001', 'Inspected user ID matches target');
    assert(finData.wallets.length > 0, 'Inspected user wallets list populated');
    assert(finData.transactions.length > 0, 'Inspected user transactions list populated');
    assert(finData.summary.total_balance > 0, 'Inspected user summary total_balance populated');
    
    // Verify Audit Log recorded in Admin State
    const refreshedAdminState = await request('GET', '/api/state?userId=usr_admin_001');
    const auditLogs = refreshedAdminState.data.auditLogs || [];
    const viewAudit = auditLogs.find(a => a.action === 'view_user_financials' && a.target_user_id === 'usr_tatadana_001');
    assert(Boolean(viewAudit), 'Audit log entry created for viewing user financials', JSON.stringify(viewAudit));

    // ---------------------------------------------------------
    // Test 6: Cross-Tenant Mutation Protections
    // ---------------------------------------------------------
    console.log('\n--- Test Suite 6: Cross-Tenant Mutation Protections ---');
    // User B tries to delete User A's transaction
    const targetTx = userATxs[0];
    if (targetTx) {
      const illegalDelete = await request('DELETE', `/api/transactions/${targetTx.id}?userId=${newUserId}`);
      assert(illegalDelete.status === 403, 'User cannot delete another user transaction (403 Forbidden)');
    } else {
      console.log('  ⚠️ SKIP: No User A transaction to test illegal delete');
    }

    // New user creates a wallet with bank
    const createWalletRes = await request('POST', '/api/wallets', {
      userId: newUserId,
      name: 'BCA Tabungan Pribadi',
      type: 'bank',
      bankName: 'BCA',
      balance: 1500000,
      icon: '🏦'
    });
    assert(createWalletRes.status === 200 && createWalletRes.data.ok, 'New user creates first wallet with bank selection');
    const createdWalletId = createWalletRes.data.wallet.id;

    // Verify User A does NOT see this new wallet
    const checkUserAAfter = await request('GET', '/api/state?userId=usr_tatadana_001');
    const hasLeakedWallet = checkUserAAfter.data.wallets.some(w => w.id === createdWalletId);
    assert(!hasLeakedWallet, 'New wallet of new user did NOT leak into User A state');

    // New user creates transaction
    const createTxRes = await request('POST', '/api/transactions', {
      userId: newUserId,
      type: 'expense',
      amount: 50000,
      category: '🍜 Makanan & Minuman',
      wallet: 'BCA Tabungan Pribadi',
      description: 'Makan siang padang'
    });
    assert(createTxRes.status === 200 && createTxRes.data.ok, 'New user creates first transaction');
    const createdTxId = createTxRes.data.transaction.id;

    // Verify User A does NOT see this new transaction
    const checkUserATxAfter = await request('GET', '/api/state?userId=usr_tatadana_001');
    const hasLeakedTx = checkUserATxAfter.data.transactions.some(tx => tx.id === createdTxId);
    assert(!hasLeakedTx, 'New transaction did NOT leak into User A state');

    // Verify New user state now has 1 wallet and 1 transaction, balance updated to 1450000
    const checkNewUserAfter = await request('GET', `/api/state?userId=${newUserId}`);
    assert(checkNewUserAfter.data.wallets.length === 1, 'New user now has 1 wallet');
    assert(checkNewUserAfter.data.wallets[0].balance === 1450000, 'New user wallet balance decreased to 1,450,000');
    assert(checkNewUserAfter.data.transactions.length === 1, 'New user has 1 transaction');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
