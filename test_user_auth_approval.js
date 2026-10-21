/**
 * TataDana Fintech SaaS - Auth, WhatsApp OTP & Approval Verification Suite
 * Tests:
 * 1. WhatsApp OTP Generation & Verification
 * 2. Login Session Separation (User vs Admin Portals)
 * 3. Route Protection Middleware (403 Forbidden for Regular Users)
 * 4. User Registration Approval Lifecycle (Pending -> Approved / Rejected)
 * 5. Admin User Management & Approval API
 */

const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, testName, extraInfo = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${testName} ${extraInfo ? '-> ' + extraInfo : ''}`);
  }
}

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };
    let postData = null;

    if (body !== null) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(rawData);
        } catch (e) {
          json = null;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          raw: rawData
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAuthApprovalTests() {
  console.log('\n==================================================================');
  console.log('🛡️ RUNNING TATADANA AUTH, WHATSAPP OTP & ADMIN APPROVAL TEST SUITE');
  console.log('==================================================================\n');

  // Auto-start server if not already running
  try {
    await request('GET', '/api/state');
  } catch (e) {
    require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  // Reset state before running auth tests
  try {
    await request('POST', '/api/test/reset-state');
  } catch (e) {}

  // ====================================================================
  // 1. WHATSAPP OTP VERIFICATION SYSTEM
  // ====================================================================
  console.log('--- [CATEGORY 1] WHATSAPP OTP VERIFICATION SYSTEM ---');

  // Test 1.1: Send OTP to invalid phone number format
  try {
    const res = await request('POST', '/api/auth/send-whatsapp-otp', { phone_number: '123' });
    assert(res.status === 400 && res.data.ok === false, 'T1.1: Invalid short phone number rejected with HTTP 400');
  } catch (err) {
    assert(false, 'T1.1 failed with network error: ' + err.message);
  }

  // Test 1.2: Send OTP to valid Indonesian phone number
  let testOtp = null;
  const testPhone = '081298765432';
  try {
    const res = await request('POST', '/api/auth/send-whatsapp-otp', { phone_number: testPhone });
    assert(res.status === 200 && res.data.ok === true && res.data.otp, 'T1.2: Valid WhatsApp OTP generated and sent successfully');
    testOtp = res.data.otp;
  } catch (err) {
    assert(false, 'T1.2 failed with network error: ' + err.message);
  }

  // Test 1.3: Verify with incorrect OTP code
  try {
    const res = await request('POST', '/api/auth/verify-whatsapp-otp', { phone_number: testPhone, otp: '999999' });
    assert(res.status === 400 && res.data.ok === false, 'T1.3: Incorrect OTP code rejected with HTTP 400');
  } catch (err) {
    assert(false, 'T1.3 failed with network error: ' + err.message);
  }

  // Test 1.4: Verify with master test fallback OTP code (123456)
  try {
    const res = await request('POST', '/api/auth/verify-whatsapp-otp', { phone_number: testPhone, otp: '123456' });
    assert(res.status === 200 && res.data.ok === true && res.data.verified === true, 'T1.4: Master test fallback code 123456 verifies successfully');
  } catch (err) {
    assert(false, 'T1.4 failed with network error: ' + err.message);
  }

  // ====================================================================
  // 2. SESSION SEPARATION & PORTAL ACCESS CONTROLS
  // ====================================================================
  console.log('\n--- [CATEGORY 2] SESSION SEPARATION & PORTAL ACCESS CONTROLS ---');

  // Test 2.1: Regular user logins via User portal (Allowed)
  try {
    const res = await request('POST', '/api/auth/login', {
      identifier: 'siti@gmail.com',
      rolePortal: 'user',
      method: 'Email Login'
    });
    assert(res.status === 200 && res.data.ok === true && res.data.user.role === 'user', 'T2.1: Regular user logins via User Portal successfully');
  } catch (err) {
    assert(false, 'T2.1 failed: ' + err.message);
  }

  // Test 2.2: Regular user attempts login via Admin portal (Blocked 403)
  try {
    const res = await request('POST', '/api/auth/login', {
      identifier: 'siti@gmail.com',
      rolePortal: 'admin',
      method: 'Admin Login'
    });
    assert(res.status === 403 && res.data.ok === false, 'T2.2: Regular user blocked from Admin Portal with HTTP 403 Forbidden');
  } catch (err) {
    assert(false, 'T2.2 failed: ' + err.message);
  }

  // Test 2.3: Admin logins via Admin portal (Allowed)
  try {
    const res = await request('POST', '/api/auth/login', {
      identifier: 'admin@tatadana.id',
      rolePortal: 'admin',
      method: 'Superadmin Login'
    });
    assert(res.status === 200 && res.data.ok === true && res.data.user.role === 'admin', 'T2.3: Administrator logins via Admin Portal successfully');
  } catch (err) {
    assert(false, 'T2.3 failed: ' + err.message);
  }

  // Test 2.4: Seeded Admin Restu Ahmad Hidayat logins with password Restu21!
  try {
    const res = await request('POST', '/api/auth/login', {
      identifier: 'restu@tatadana.id',
      password: 'Restu21!',
      rolePortal: 'admin',
      method: 'Admin Password Login'
    });
    assert(
      res.status === 200 &&
      res.data.ok === true &&
      res.data.user.role === 'admin' &&
      res.data.user.full_name === 'Restu Ahmad Hidayat' &&
      res.data.user.approval_status === 'approved',
      'T2.4: Admin Restu Ahmad Hidayat logins with password Restu21! and bypasses approval'
    );
  } catch (err) {
    assert(false, 'T2.4 failed: ' + err.message);
  }

  // Test 2.5: Admin Restu Ahmad Hidayat login with incorrect password rejected with 401
  try {
    const res = await request('POST', '/api/auth/login', {
      identifier: 'restu@tatadana.id',
      password: 'WrongPassword999!',
      rolePortal: 'admin',
      method: 'Admin Password Login'
    });
    assert(res.status === 401 && res.data.ok === false, 'T2.5: Restu Ahmad Hidayat login with wrong password rejected with HTTP 401');
  } catch (err) {
    assert(false, 'T2.5 failed: ' + err.message);
  }

  // Test 2.6: Admin Restu Ahmad Hidayat logins with phone number 083194703373
  try {
    const res = await request('POST', '/api/auth/login', {
      identifier: '083194703373',
      rolePortal: 'admin',
      method: 'Phone Login'
    });
    assert(
      res.status === 200 &&
      res.data.ok === true &&
      res.data.user.role === 'admin' &&
      res.data.user.phone_number === '083194703373',
      'T2.6: Admin Restu Ahmad Hidayat logins with phone number 083194703373'
    );
  } catch (err) {
    assert(false, 'T2.6 failed: ' + err.message);
  }

  // ====================================================================
  // 3. ROUTE PROTECTION MIDDLEWARE
  // ====================================================================
  console.log('\n--- [CATEGORY 3] ROUTE PROTECTION MIDDLEWARE ---');

  // Test 3.1: Regular user tries to access /admin (Blocked 403)
  try {
    const res = await request('GET', '/admin', null, { 'x-user-role': 'user' });
    assert(res.status === 403 && res.data.ok === false, 'T3.1: GET /admin with x-user-role: user returns HTTP 403 Forbidden');
  } catch (err) {
    assert(false, 'T3.1 failed: ' + err.message);
  }

  // Test 3.2: Regular user tries to access /api/admin/users (Blocked 403)
  try {
    const res = await request('GET', '/api/admin/users', null, { 'x-user-role': 'user' });
    assert(res.status === 403 && res.data.ok === false, 'T3.2: GET /api/admin/users with x-user-role: user returns HTTP 403 Forbidden');
  } catch (err) {
    assert(false, 'T3.2 failed: ' + err.message);
  }

  // Test 3.3: Administrator accesses /api/admin/users (Allowed 200)
  try {
    const res = await request('GET', '/api/admin/users', null, { 'x-user-role': 'admin' });
    assert(res.status === 200 && res.data.ok === true && Array.isArray(res.data.users), 'T3.3: Administrator accesses /api/admin/users with HTTP 200');
  } catch (err) {
    assert(false, 'T3.3 failed: ' + err.message);
  }

  // ====================================================================
  // 4. USER REGISTRATION & APPROVAL STATE MACHINE
  // ====================================================================
  console.log('\n--- [CATEGORY 4] USER REGISTRATION & APPROVAL STATE MACHINE ---');

  // Test 4.1: Seeded pending user Ahmad Fauzi blocked from login
  try {
    const res = await request('POST', '/api/auth/login', {
      identifier: 'fauzi.dev@yahoo.com',
      rolePortal: 'user',
      method: 'Email Login'
    });
    assert(res.status === 403 && res.data.approval_status === 'pending', 'T4.1: Pending user Ahmad Fauzi blocked from login with 403 & status pending');
  } catch (err) {
    assert(false, 'T4.1 failed: ' + err.message);
  }

  // Test 4.2: Seeded rejected user Riko Kurniawan blocked from login
  try {
    const res = await request('POST', '/api/auth/login', {
      identifier: 'riko.kurniawan@gmail.com',
      rolePortal: 'user',
      method: 'Email Login'
    });
    assert(res.status === 403 && res.data.approval_status === 'rejected', 'T4.2: Rejected user Riko Kurniawan blocked from login with 403 & reason provided');
  } catch (err) {
    assert(false, 'T4.2 failed: ' + err.message);
  }

  // Test 4.3: Register brand-new user via API
  const newCandidatePhone = '0879' + String(Date.now()).slice(-8);
  const newCandidateName = 'Bambang Pamungkas';
  let candidateUserId = null;
  try {
    const res = await request('POST', '/api/auth/register', {
      full_name: newCandidateName,
      phone_number: newCandidatePhone,
      job_profile: 'freelance'
    });
    assert(res.status === 200 && res.data.ok === true && res.data.user.approval_status === 'pending', 'T4.3: New user registered with default approval_status: pending');
    candidateUserId = res.data.user.id;
  } catch (err) {
    assert(false, 'T4.3 failed: ' + err.message);
  }

  // Test 4.4: Newly registered user cannot login while pending
  try {
    const res = await request('POST', '/api/auth/login', {
      identifier: newCandidatePhone,
      rolePortal: 'user',
      method: 'Phone Login'
    });
    assert(res.status === 403 && res.data.approval_status === 'pending', 'T4.4: Brand-new user immediately blocked from login before approval');
  } catch (err) {
    assert(false, 'T4.4 failed: ' + err.message);
  }

  // ====================================================================
  // 5. ADMIN USER MANAGEMENT & APPROVAL ACTIONS
  // ====================================================================
  console.log('\n--- [CATEGORY 5] ADMIN USER MANAGEMENT & APPROVAL ACTIONS ---');

  // Test 5.1: Admin views users list with count and filters
  try {
    const res = await request('GET', '/api/admin/users?status=pending');
    assert(res.status === 200 && res.data.ok === true && res.data.users.every(u => u.approval_status === 'pending'), 'T5.1: Admin filters users by status=pending');
  } catch (err) {
    assert(false, 'T5.1 failed: ' + err.message);
  }

  // Test 5.2: Rejecting candidate user without reason returns 400
  try {
    const res = await request('POST', '/api/admin/users/approval', {
      user_id: candidateUserId,
      action: 'reject',
      reason: ''
    });
    assert(res.status === 400 && res.data.ok === false, 'T5.2: Rejecting user without mandatory reason fails with HTTP 400');
  } catch (err) {
    assert(false, 'T5.2 failed: ' + err.message);
  }

  // Test 5.3: Admin approves the candidate user
  try {
    const res = await request('POST', '/api/admin/users/approval', {
      user_id: candidateUserId,
      action: 'approve',
      notes: 'Verifikasi identitas dan kontak valid'
    });
    assert(res.status === 200 && res.data.ok === true && res.data.user.approval_status === 'approved', 'T5.3: Admin successfully approves user registration');
  } catch (err) {
    assert(false, 'T5.3 failed: ' + err.message);
  }

  // Test 5.4: Newly approved user can now successfully login and enter dashboard!
  try {
    const res = await request('POST', '/api/auth/login', {
      identifier: newCandidatePhone,
      rolePortal: 'user',
      method: 'Phone Login'
    });
    assert(res.status === 200 && res.data.ok === true && res.data.user.approval_status === 'approved', 'T5.4: Approved user can now immediately login and enter dashboard');
  } catch (err) {
    assert(false, 'T5.4 failed: ' + err.message);
  }

  // Test 5.5: Admin rejects Ahmad Fauzi with explicit reason
  try {
    const res = await request('POST', '/api/admin/users/approval', {
      user_id: 'usr_tatadana_003',
      action: 'reject',
      reason: 'Dokumen pendukung pendaftaran tidak lengkap'
    });
    assert(res.status === 200 && res.data.ok === true && res.data.user.approval_status === 'rejected', 'T5.5: Admin successfully rejects user registration with reason');
  } catch (err) {
    assert(false, 'T5.5 failed: ' + err.message);
  }

  // Test 5.6: Re-approving Ahmad Fauzi unlocks their account
  try {
    const res = await request('POST', '/api/admin/users/approval', {
      user_id: 'usr_tatadana_003',
      action: 'approve',
      notes: 'Dokumen susulan telah dilengkapi'
    });
    assert(res.status === 200 && res.data.ok === true && res.data.user.approval_status === 'approved', 'T5.6: Admin can re-approve a previously rejected user upon document resubmission');
  } catch (err) {
    assert(false, 'T5.6 failed: ' + err.message);
  }

  // ====================================================================
  // 6. SECURITY BYPASS CLOSURE, AUTO-FILL REMOVAL & REACTIVE POLLING (REQUIREMENTS 1, 2, 3)
  // ====================================================================
  console.log('\n--- [CATEGORY 6] BYPASS CLOSURE, AUTO-FILL ELIMINATION & REACTIVE POLLING ---');

  // Test 6.1: Tutup Akses Bypass: GET /dashboard with unauthenticated header redirects to /login (302)
  try {
    const res = await request('GET', '/dashboard', null, { 'x-auth-status': 'unauthenticated' });
    const isRedirect = res.status === 302 && res.headers.location === '/login';
    assert(isRedirect, 'T6.1: Unauthenticated request to /dashboard redirects (302) to /login');
  } catch (err) {
    assert(false, 'T6.1 failed: ' + err.message);
  }

  // Test 6.2: Frontend HTML does not contain hardcoded auto-fill credentials
  try {
    const fs = require('fs');
    const html = fs.readFileSync('./public/index.html', 'utf8');
    const hasAdminEmailAutofill = html.includes('value="admin@tatadana.id"');
    const hasBudiEmailAutofill = html.includes('value="budi@tatadana.id"');
    const hasHardcodedPassword = html.includes('value="Restu21!"') || html.includes('value="••••••••"');
    assert(!hasAdminEmailAutofill && !hasBudiEmailAutofill && !hasHardcodedPassword, 'T6.2: Form fields in index.html are clean without hardcoded credential values');
  } catch (err) {
    assert(false, 'T6.2 failed: ' + err.message);
  }

  // Test 6.3: Pending approval screen contains reactive polling controls & indicator
  try {
    const fs = require('fs');
    const html = fs.readFileSync('./public/index.html', 'utf8');
    const hasPollingIndicator = html.includes('id="pending-polling-indicator"') && html.includes('pending-polling-dot');
    const hasCheckBtn = html.includes('id="btn-check-approval-status"') && html.includes('manualCheckApprovalStatus()');
    const hasNoAdminBypassBtn = !html.includes('Buka Portal Admin Superadmin');
    assert(hasPollingIndicator && hasCheckBtn && hasNoAdminBypassBtn, 'T6.3: Pending screen contains 3s polling indicator, manual check button, and no misleading admin bypass');
  } catch (err) {
    assert(false, 'T6.3 failed: ' + err.message);
  }

  // Test 6.4: Reactive polling functions exist in client-side script
  try {
    const fs = require('fs');
    const html = fs.readFileSync('./public/index.html', 'utf8');
    const hasStartPolling = html.includes('function startApprovalPolling');
    const hasStopPolling = html.includes('function stopApprovalPolling');
    const hasManualCheck = html.includes('function manualCheckApprovalStatus');
    const hasCheckStatus = html.includes('function checkApprovalStatus');
    assert(hasStartPolling && hasStopPolling && hasManualCheck && hasCheckStatus, 'T6.4: Client script implements startApprovalPolling, stopApprovalPolling, manualCheckApprovalStatus, and checkApprovalStatus');
  } catch (err) {
    assert(false, 'T6.4 failed: ' + err.message);
  }

  // Test 6.5: GET /api/auth/status for a pending user
  let tempUserId = null;
  const tempPhone = '085799988811';
  try {
    const regRes = await request('POST', '/api/auth/register', {
      full_name: 'Bima Satria Polling',
      phone_number: tempPhone,
      job_profile: 'karyawan',
      whatsapp_verified: true
    });
    tempUserId = regRes.data.user.id;

    const statusRes = await request('GET', `/api/auth/status?userId=${tempUserId}`);
    assert(statusRes.status === 200 && statusRes.data.ok === true && statusRes.data.approval_status === 'pending' && statusRes.data.is_approved === false,
      'T6.5: GET /api/auth/status returns status: 200 with approval_status: pending and is_approved: false');
  } catch (err) {
    assert(false, 'T6.5 failed: ' + err.message);
  }

  // Test 6.6: GET /api/auth/status querying by phone number
  try {
    const statusRes = await request('GET', `/api/auth/status?phone=${tempPhone}`);
    assert(statusRes.status === 200 && statusRes.data.phone_number === tempPhone && statusRes.data.approval_status === 'pending',
      'T6.6: GET /api/auth/status by phone number correctly locates pending user');
  } catch (err) {
    assert(false, 'T6.6 failed: ' + err.message);
  }

  // Test 6.7: Approval transition reflected in polling endpoint with redirect: '/dashboard'
  try {
    // Admin approves temp user
    await request('POST', '/api/admin/users/approval', {
      user_id: tempUserId,
      action: 'approve',
      notes: 'Disetujui untuk uji reactivity polling'
    });

    const statusRes = await request('GET', `/api/auth/status?userId=${tempUserId}`);
    assert(statusRes.status === 200 && statusRes.data.is_approved === true && statusRes.data.approval_status === 'approved' && statusRes.data.redirect === '/dashboard',
      'T6.7: Once approved, GET /api/auth/status reflects is_approved: true with redirect: /dashboard');
  } catch (err) {
    assert(false, 'T6.7 failed: ' + err.message);
  }

  // Test 6.8: GET /api/auth/status for unknown user returns HTTP 404
  try {
    const statusRes = await request('GET', '/api/auth/status?userId=usr_unknown_nonexistent');
    assert(statusRes.status === 404 && statusRes.data.ok === false, 'T6.8: GET /api/auth/status for unknown user returns HTTP 404');
  } catch (err) {
    assert(false, 'T6.8 failed: ' + err.message);
  }

  console.log('\n==================================================================');
  console.log(`📊 TEST SUITE RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('==================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAuthApprovalTests();
