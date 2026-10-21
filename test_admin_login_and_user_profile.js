/**
 * Test Suite: Dedicated Admin Login & Admin User Profile Inspection Verification
 */

const http = require('http');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) { json = body; }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          body: body
        });
      });
    });
    req.on('error', reject);
    if (data) {
      if (typeof data === 'object') {
        req.write(JSON.stringify(data));
      } else {
        req.write(data);
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('==================================================================');
  console.log('🛡️ RUNNING TATADANA DEDICATED ADMIN LOGIN & USER PROFILE TEST SUITE');
  console.log('==================================================================\n');

  // Auto-start server if not already running
  try {
    await request({ hostname: 'localhost', port: 3000, path: '/api/state', method: 'GET' });
  } catch (e) {
    require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  // Group 1: Dedicated Route /admin/login SSR & Structure
  console.log('▶ Group 1: Dedicated Route /admin/login Access & SSR');
  const adminLoginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin/login',
    method: 'GET'
  });
  assert(adminLoginRes.statusCode === 200, 'GET /admin/login returns HTTP 200');
  assert(adminLoginRes.body.includes('id="view-admin-login" class="page-view flex-1 flex min-h-screen'), 'view-admin-login is pre-activated on direct access /admin/login');
  assert(adminLoginRes.body.includes('id="view-landing" class="page-view hidden'), 'Landing page is hidden when accessing /admin/login');
  assert(adminLoginRes.body.includes('Login Administrator'), 'Admin Login header is rendered in HTML');
  assert(adminLoginRes.body.includes('id="form-admin-dedicated-login"'), 'Dedicated admin login form exists');
  assert(adminLoginRes.body.includes('id="admin-l-email"'), 'Admin username/email input exists');
  assert(adminLoginRes.body.includes('id="admin-l-password"'), 'Admin password input exists');
  assert(adminLoginRes.body.includes('id="btn-admin-dedicated-submit"'), 'Admin submit button exists');

  // Trailing slash normalization
  const trailingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin/login/',
    method: 'GET'
  });
  assert(trailingRes.statusCode === 200, 'GET /admin/login/ with trailing slash returns HTTP 200');

  // Exemption from 403 when x-user-role: user accesses /admin/login
  const userAccessRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin/login',
    method: 'GET',
    headers: { 'x-user-role': 'user' }
  });
  assert(userAccessRes.statusCode === 200, 'User role accessing /admin/login is allowed to render login page (not 403)');

  // But user role accessing /admin is strictly 403
  const userBlockedAdmin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET',
    headers: { 'x-user-role': 'user' }
  });
  assert(userBlockedAdmin.statusCode === 403, 'User role accessing /admin is strictly blocked with HTTP 403 Forbidden');

  // Group 2: Admin Login Authentication with Permanent Credentials
  console.log('\n▶ Group 2: Permanent Admin Credentials & Authentication');
  const validAdminLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'restu21@tatadana.com',
    password: 'restuahmad21',
    rolePortal: 'admin'
  });
  assert(validAdminLogin.statusCode === 200 && validAdminLogin.data.ok === true, 'Admin login with restu21@tatadana.com / restuahmad21 succeeds with 200');
  assert(validAdminLogin.data.user.role === 'admin', 'Authenticated admin role is admin');
  assert(validAdminLogin.data.user.id === 'usr_admin_restu', 'Admin user ID is usr_admin_restu');

  // Legacy Restu21! password also supported for backwards compatibility
  const legacyAdminLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'restu21@tatadana.com',
    password: 'Restu21!',
    rolePortal: 'admin'
  });
  assert(legacyAdminLogin.statusCode === 200 && legacyAdminLogin.data.ok === true, 'Admin login with legacy password Restu21! also succeeds');

  // Wrong password rejected
  const wrongPassLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'restu21@tatadana.com',
    password: 'wrongpassword',
    rolePortal: 'admin'
  });
  assert(wrongPassLogin.statusCode === 401 && wrongPassLogin.data.ok === false, 'Admin login with wrong password rejected with HTTP 401');

  // Regular user trying to log into Admin Portal rejected
  const regularUserAdminPortal = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'budi.pratama@tatadana.id',
    rolePortal: 'admin'
  });
  assert(regularUserAdminPortal.statusCode === 403, 'Regular user login to rolePortal: admin rejected with HTTP 403 Forbidden');

  // Group 3: Admin User Profile Inspection Elements & Modals
  console.log('\n▶ Group 3: Admin User Profile Modal & Data Binding');
  const indexHtml = adminLoginRes.body;
  assert(indexHtml.includes('id="modal-user-detail"'), 'Modal user detail container #modal-user-detail exists');
  assert(indexHtml.includes('id="modal-user-avatar"'), 'Modal user avatar #modal-user-avatar exists');
  assert(indexHtml.includes('id="modal-user-name"'), 'Modal user name #modal-user-name exists');
  assert(indexHtml.includes('id="modal-user-email"'), 'Modal user email #modal-user-email exists');
  assert(indexHtml.includes('id="modal-user-phone"'), 'Modal user phone #modal-user-phone exists');
  assert(indexHtml.includes('id="modal-user-wa-badge"'), 'Modal user WhatsApp OTP verified badge exists');
  assert(indexHtml.includes('id="modal-user-job"'), 'Modal user job #modal-user-job exists');
  assert(indexHtml.includes('id="modal-user-bio"'), 'Modal user bio #modal-user-bio exists');
  assert(indexHtml.includes('id="modal-user-plan"'), 'Modal user plan #modal-user-plan exists');
  assert(indexHtml.includes('id="modal-user-balance"'), 'Modal user balance #modal-user-balance exists');
  assert(indexHtml.includes('id="modal-user-tx-count"'), 'Modal user transaction count #modal-user-tx-count exists');
  assert(indexHtml.includes('id="modal-user-status"'), 'Modal user status #modal-user-status exists');
  assert(indexHtml.includes('id="modal-user-joined"'), 'Modal user joined date #modal-user-joined exists');
  assert(indexHtml.includes('id="modal-user-actions"'), 'Modal contextual action buttons container exists');
  assert(indexHtml.includes('👁️ Lihat Profil'), 'Action button in user table includes "👁️ Lihat Profil"');
  assert(indexHtml.includes('viewUserProfile('), 'Helper function viewUserProfile exists in client script');

  console.log('\n==================================================================');
  console.log(`📊 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('==================================================================');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Unhandled error during test run:', err);
  process.exit(1);
});
