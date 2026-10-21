// ====================================================================
// Test Suite: Automated Verification for TataDana Page Navigation & Routing
// Tests URL routing in server.js, SSR view pre-activation, and client UI triggers
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
          body: parsed
        });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runNavigationTests() {
  console.log('🧭 RUNNING TATADANA NAVIGATION & ROUTING VERIFICATION...\n');
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
    await get('/');
  } catch (e) {
    runningServer = require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  // ------------------------------------------------------------------
  // 1. ROUTE VERIFICATION: GET /
  // ------------------------------------------------------------------
  try {
    const res = await get('/');
    assert(res.status === 200, 'TEST N1: GET / returns status 200');
    assert(res.headers['content-type'].includes('text/html'), 'TEST N2: GET / Content-Type is text/html');
    assert(res.body.includes('id="view-landing" class="page-view flex-1"'), 'TEST N3: Landing page view is active and visible by default');
    assert(res.body.includes('id="view-login" class="page-view hidden'), 'TEST N4: Login view is hidden on landing page');
    assert(res.body.includes('id="view-dashboard" class="page-view hidden'), 'TEST N5: Dashboard view is hidden on landing page');
    assert(res.body.includes('id="view-admin" class="page-view hidden'), 'TEST N6: Admin view is hidden on landing page');
  } catch (e) {
    assert(false, 'GET / failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 2. ROUTE VERIFICATION: GET /login
  // ------------------------------------------------------------------
  try {
    const res = await get('/login');
    assert(res.status === 200, 'TEST N7: GET /login returns status 200');
    assert(res.body.includes('id="view-landing" class="page-view hidden flex-1"'), 'TEST N8: Landing page is hidden when accessing /login');
    assert(res.body.includes('id="view-login" class="page-view flex-1 flex min-h-screen"'), 'TEST N9: Login page is pre-activated on direct access /login');
    assert(res.body.includes('Selamat Datang Kembali'), 'TEST N10: Login content is rendered');
  } catch (e) {
    assert(false, 'GET /login failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 3. ROUTE VERIFICATION: GET /register
  // ------------------------------------------------------------------
  try {
    const res = await get('/register');
    assert(res.status === 200, 'TEST N11: GET /register returns status 200');
    assert(res.body.includes('id="view-landing" class="page-view hidden flex-1"'), 'TEST N12: Landing page is hidden when accessing /register');
    assert(res.body.includes('id="view-register" class="page-view flex-1 flex min-h-screen"'), 'TEST N13: Register page is pre-activated on direct access /register');
    assert(res.body.includes('Daftar Akun Baru'), 'TEST N14: Register form is rendered');
  } catch (e) {
    assert(false, 'GET /register failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 4. ROUTE VERIFICATION: GET /dashboard
  // ------------------------------------------------------------------
  try {
    const res = await get('/dashboard');
    assert(res.status === 200, 'TEST N15: GET /dashboard returns status 200');
    assert(res.body.includes('id="view-landing" class="page-view hidden flex-1"'), 'TEST N16: Landing page is hidden when accessing /dashboard');
    assert(res.body.includes('id="view-dashboard" class="page-view flex-1 flex min-h-screen"'), 'TEST N17: User Dashboard is pre-activated on direct access /dashboard');
    assert(res.body.includes('Beranda Keuangan'), 'TEST N18: User Dashboard header is rendered');
  } catch (e) {
    assert(false, 'GET /dashboard failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 5. ROUTE VERIFICATION: GET /admin
  // ------------------------------------------------------------------
  try {
    const res = await get('/admin');
    assert(res.status === 200, 'TEST N19: GET /admin returns status 200');
    assert(res.body.includes('id="view-landing" class="page-view hidden flex-1"'), 'TEST N20: Landing page is hidden when accessing /admin');
    assert(res.body.includes('id="view-admin" class="page-view flex-1 flex min-h-screen bg-zinc-950 text-zinc-100"'), 'TEST N21: Admin Panel is pre-activated on direct access /admin');
    assert(res.body.includes('Superadmin Control Panel'), 'TEST N22: Admin Panel heading is rendered');
  } catch (e) {
    assert(false, 'GET /admin failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 6. ROUTE VERIFICATION: Trailing slash normalization (/dashboard/)
  // ------------------------------------------------------------------
  try {
    const res = await get('/dashboard/');
    assert(res.status === 200, 'TEST N23: GET /dashboard/ returns status 200');
    assert(res.body.includes('id="view-dashboard" class="page-view flex-1 flex min-h-screen"'), 'TEST N24: Normalized /dashboard/ view is pre-activated');
  } catch (e) {
    assert(false, 'GET /dashboard/ failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 7. ROUTE VERIFICATION: Fallback redirect for unknown routes
  // ------------------------------------------------------------------
  try {
    const res = await get('/invalid-random-path-404');
    assert(res.status === 302, 'TEST N25: Unknown routes redirect with 302');
    assert(res.headers.location === '/', 'TEST N26: Unknown route redirect location is /');
  } catch (e) {
    assert(false, 'Unknown route fallback failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 8. CLIENT UI AUTOMATION & BUTTONS AUDIT
  // ------------------------------------------------------------------
  const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

  // Landing page buttons
  assert(htmlContent.includes(`onclick="navigate('login')"`) && htmlContent.includes('Masuk'), 'TEST N27: Landing page has Masuk button to login');
  assert(htmlContent.includes(`onclick="navigate('register')"`) && (htmlContent.includes('Coba Gratis') || htmlContent.includes('Mulai Sekarang')), 'TEST N28: Landing page has Coba Gratis / Mulai Sekarang button to register');
  assert(htmlContent.includes(`onclick="navigate('dashboard')"`) && htmlContent.includes('Buka Dashboard'), 'TEST N29: Landing page has Buka Dashboard button to dashboard');
  assert(htmlContent.includes(`onclick="navigate('admin')"`) && htmlContent.includes('Admin Console'), 'TEST N30: Landing page has Admin Console button to admin');

  // Login automation & triggers
  assert(htmlContent.includes('handleLoginSubmit(event)'), 'TEST N31: Login forms trigger handleLoginSubmit');
  assert(htmlContent.includes(`handleLoginSuccess('Google OAuth')`), 'TEST N32: Google button triggers handleLoginSuccess with feedback');
  assert(htmlContent.includes(`showToast(\`\${methodName} berhasil! Mengalihkan ke dashboard...\`)`), 'TEST N33: Login success shows feedback toast');
  assert(htmlContent.includes(`navigate('dashboard')`), 'TEST N34: Login success navigates automatically to dashboard');

  // Register automation & triggers
  assert(htmlContent.includes('handleRegStep1(event)'), 'TEST N35: Register step 1 advances to AI onboarding');
  assert(htmlContent.includes('handleFinishRegistration()'), 'TEST N36: Register step 2 has finish registration action');
  assert(htmlContent.includes('Akun & struktur kategori Supabase berhasil disiapkan! Mengalihkan ke dashboard...'), 'TEST N37: Register completion shows feedback toast');

  // Dashboard buttons
  assert(htmlContent.includes(`onclick="navigate('landing')"`) && htmlContent.includes('Keluar'), 'TEST N38: Dashboard has Keluar button to landing');
  assert(htmlContent.includes(`onclick="navigate('admin')"`) && htmlContent.includes('Admin Console'), 'TEST N39: Dashboard has Admin Console button to admin');

  // Admin panel buttons & Impersonation
  assert(htmlContent.includes(`onclick="navigate('dashboard')"`) && htmlContent.includes('Kembali ke Dashboard'), 'TEST N40: Admin has Kembali ke Dashboard button');
  assert(htmlContent.includes(`impersonateUser('\${u.id}')`) && htmlContent.includes('Impersonate'), 'TEST N41: Admin user table has Impersonate button');
  assert(htmlContent.includes('/api/admin/impersonate'), 'TEST N42: Impersonate sends POST to /api/admin/impersonate');
  assert(htmlContent.includes(`showToast(\`Impersonasi aktif sebagai \${data.user.full_name}! Mengalihkan ke dashboard...\`)`), 'TEST N43: Impersonate shows feedback toast');

  // Client-side Navigation infrastructure
  assert(htmlContent.includes('window.history.pushState'), 'TEST N44: History API pushState is implemented');
  assert(htmlContent.includes(`window.addEventListener('popstate'`), 'TEST N45: popstate event listener handles Back/Forward');
  assert(htmlContent.includes('syncRouteFromPath()'), 'TEST N46: syncRouteFromPath synchronizes route on initial load');

  // ------------------------------------------------------------------
  // 9. SSR TITLE SYNCHRONIZATION TESTS
  // ------------------------------------------------------------------
  try {
    const rHome = await get('/');
    assert(rHome.body.includes('<title>TataDana — Catat Keuangan Semudah Chat Langsung dari Telegram</title>'), 'TEST N47: SSR title on / is landing title');
    const rLogin = await get('/login');
    assert(rLogin.body.includes('<title>Masuk — TataDana Fintech</title>'), 'TEST N48: SSR title on /login is Masuk — TataDana Fintech');
    const rReg = await get('/register');
    assert(rReg.body.includes('<title>Daftar Akun — TataDana Fintech</title>'), 'TEST N49: SSR title on /register is Daftar Akun — TataDana Fintech');
    const rDash = await get('/dashboard');
    assert(rDash.body.includes('<title>Dashboard Pengguna — TataDana</title>'), 'TEST N50: SSR title on /dashboard is Dashboard Pengguna — TataDana');
    const rAdmin = await get('/admin');
    assert(rAdmin.body.includes('<title>Superadmin Control Panel — TataDana</title>'), 'TEST N51: SSR title on /admin is Superadmin Control Panel — TataDana');
  } catch (e) {
    assert(false, 'SSR title tests failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 10. TRAILING SLASH NORMALIZATION FOR ALL ROUTES
  // ------------------------------------------------------------------
  try {
    const rLoginSlash = await get('/login/');
    assert(rLoginSlash.status === 200 && rLoginSlash.body.includes('id="view-login" class="page-view flex-1 flex min-h-screen"'), 'TEST N52: Trailing slash /login/ returns 200 with Login view pre-activated');
    const rRegSlash = await get('/register/');
    assert(rRegSlash.status === 200 && rRegSlash.body.includes('id="view-register" class="page-view flex-1 flex min-h-screen"'), 'TEST N53: Trailing slash /register/ returns 200 with Register view pre-activated');
    const rAdminSlash = await get('/admin/');
    assert(rAdminSlash.status === 200 && rAdminSlash.body.includes('id="view-admin" class="page-view flex-1 flex min-h-screen bg-zinc-950 text-zinc-100"'), 'TEST N54: Trailing slash /admin/ returns 200 with Admin view pre-activated');
  } catch (e) {
    assert(false, 'Trailing slash normalization failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 11. DEEP DASHBOARD SUBROUTES (/dashboard/:tab)
  // ------------------------------------------------------------------
  try {
    const rTx = await get('/dashboard/transactions');
    assert(rTx.status === 200 && rTx.body.includes('id="view-dashboard" class="page-view flex-1 flex min-h-screen"'), 'TEST N55: Deep subroute /dashboard/transactions returns 200 with Dashboard view pre-activated');
    const rRep = await get('/dashboard/reports');
    assert(rRep.status === 200 && rRep.body.includes('id="view-dashboard" class="page-view flex-1 flex min-h-screen"'), 'TEST N56: Deep subroute /dashboard/reports returns 200 with Dashboard view pre-activated');
    const rBud = await get('/dashboard/budgets');
    assert(rBud.status === 200 && rBud.body.includes('id="view-dashboard" class="page-view flex-1 flex min-h-screen"'), 'TEST N57: Deep subroute /dashboard/budgets returns 200 with Dashboard view pre-activated');
    const rWal = await get('/dashboard/wallets');
    assert(rWal.status === 200 && rWal.body.includes('id="view-dashboard" class="page-view flex-1 flex min-h-screen"'), 'TEST N58: Deep subroute /dashboard/wallets returns 200 with Dashboard view pre-activated');
    const rSet = await get('/dashboard/settings');
    assert(rSet.status === 200 && rSet.body.includes('id="view-dashboard" class="page-view flex-1 flex min-h-screen"'), 'TEST N59: Deep subroute /dashboard/settings returns 200 with Dashboard view pre-activated');
    const rCal = await get('/dashboard/calendar');
    assert(rCal.status === 200 && rCal.body.includes('id="view-dashboard" class="page-view flex-1 flex min-h-screen"'), 'TEST N59b: Deep subroute /dashboard/calendar returns 200 with Dashboard view pre-activated');
  } catch (e) {
    assert(false, 'Deep dashboard subroutes test failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 12. IMPERSONATE ERROR HANDLING & VALIDATION
  // ------------------------------------------------------------------
  try {
    const res = await post('/api/admin/impersonate', { userId: 'usr_non_existent' });
    assert(res.status === 404 && res.body.ok === false, 'TEST N60: Impersonate with invalid userId returns 404 error');
  } catch (e) {
    assert(false, 'Impersonate validation failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 13. AUTH LOGIN & REGISTRATION FUNCTIONALITY
  // ------------------------------------------------------------------
  try {
    const loginRes = await post('/api/auth/login', { identifier: 'siti@gmail.com', method: 'Email Login' });
    assert(loginRes.status === 200 && loginRes.body.ok === true && loginRes.body.user.full_name === 'Siti Rahmawati', 'TEST N61: Auth login switches active session to Siti Rahmawati');

    const regRes = await post('/api/auth/register', { full_name: 'Dewi Sartika', phone_number: '081399887766', job_profile: 'freelance' });
    assert(regRes.status === 200 && regRes.body.ok === true && regRes.body.user.full_name === 'Dewi Sartika', 'TEST N62: Auth register creates new account and sets active session');
  } catch (e) {
    assert(false, 'Auth API tests failed: ' + e.message);
  }

  // ------------------------------------------------------------------
  // 14. HTML MARKUP & UX INTEGRITY CHECKS
  // ------------------------------------------------------------------
  assert(!htmlContent.includes("{' '}"), 'TEST N63: Leaked JSX {" "} syntax removed from vanilla HTML');
  assert(htmlContent.includes('title="Admin Console"') && htmlContent.includes('md:hidden'), 'TEST N64: Mobile Admin Console button is present on Landing Page');
  assert(htmlContent.includes('href="/dashboard"') && htmlContent.includes('href="/admin"') && htmlContent.includes('href="/login"') && htmlContent.includes('href="/register"'), 'TEST N65: Landing Page footer contains direct navigation links');
  assert(htmlContent.includes('e.ctrlKey') && htmlContent.includes('e.metaKey'), 'TEST N66: Click interceptor respects modifier keys (Ctrl/Cmd/Shift)');
  assert(htmlContent.includes("targetPath = tabName === 'overview' ? '/dashboard' : `/dashboard/${tabName}`"), 'TEST N67: Dashboard tab switcher synchronizes URL path in history');

  // ------------------------------------------------------------------
  // 15. ADMIN APPROVAL QUEUE UI INTEGRITY CHECKS
  // ------------------------------------------------------------------
  assert(htmlContent.includes('id="approval-queue-section"'), 'TEST N68: Approval queue section is present in Admin Panel');
  assert(htmlContent.includes('id="admin-approvals-table"'), 'TEST N69: Approval queue interactive table is present');
  assert(htmlContent.includes('id="approval-action-modal"'), 'TEST N70: Approval action modal with confirmation & notes is present');
  assert(htmlContent.includes('id="appr-tab-all"') && htmlContent.includes('id="appr-tab-pending"') && htmlContent.includes('id="appr-tab-approved"') && htmlContent.includes('id="appr-tab-rejected"'), 'TEST N71: Filter tabs (All, Pending, Approved, Rejected) are present');
  assert(htmlContent.includes('id="admin-audit-section"') && htmlContent.includes('id="admin-audit-logs-table"'), 'TEST N72: Admin Audit Trail section and table are present');
  assert(htmlContent.includes('Antrean Persetujuan') && htmlContent.includes('scrollToApprovalQueue()'), 'TEST N73: Admin sidebar contains Antrean Persetujuan shortcut');
  assert(htmlContent.includes('id="new-approval-modal"'), 'TEST N74: New approval request simulation modal is present');

  // ------------------------------------------------------------------
  // 16. TATA AI IN-APP BOT WIDGET UI INTEGRITY CHECKS (MILESTONE 4 - R4)
  // ------------------------------------------------------------------
  assert(htmlContent.includes('id="tata-ai-floating-btn"'), 'TEST N75: Tata AI floating launcher button #tata-ai-floating-btn is present');
  assert(htmlContent.includes('id="tata-ai-drawer"'), 'TEST N76: Tata AI interactive chat drawer #tata-ai-drawer is present');
  assert(htmlContent.includes('id="tata-ai-messages"'), 'TEST N77: Tata AI message stream container #tata-ai-messages is present');
  assert(htmlContent.includes('id="tata-ai-input"') && htmlContent.includes('id="tata-ai-send-btn"'), 'TEST N78: Tata AI input field and send button are present');
  assert(htmlContent.includes('id="tata-ai-quick-chips"'), 'TEST N79: Tata AI quick suggestion chips container #tata-ai-quick-chips is present');
  assert(htmlContent.includes('src="/modules/tata-ai.js"'), 'TEST N80: Modular Tata AI client script is loaded via script tag');
  assert(htmlContent.includes('id="dash-tata-ai-btn"'), 'TEST N81: Dashboard header action bar contains Tanya Tata AI shortcut button');

  // ------------------------------------------------------------------
  // 17. INTERACTIVE BUDGET CALENDAR UI INTEGRITY CHECKS (MILESTONE 3 - R3)
  // ------------------------------------------------------------------
  assert(htmlContent.includes('id="nav-calendar"'), 'TEST N82: Calendar navigation tab #nav-calendar is present in sidebar');
  assert(htmlContent.includes(`onclick="switchDashTab('calendar')"`), 'TEST N83: Calendar navigation button triggers switchDashTab(\'calendar\')');
  assert(htmlContent.includes('id="dash-calendar"'), 'TEST N84: Calendar container #dash-calendar is present in dashboard');
  assert(htmlContent.includes('src="/modules/calendar.js"'), 'TEST N85: Modular Calendar client script is loaded via script tag');

  console.log(`\n======================================================`);
  console.log(`📊 NAVIGATION TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log(`======================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runNavigationTests();
