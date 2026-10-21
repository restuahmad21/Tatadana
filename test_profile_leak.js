/**
 * Test Suite: Profile Data Leakage & Reset Verification
 * Verifies:
 * 1. All dummy/hardcoded profile data is removed.
 * 2. New registered users have EMPTY pekerjaan (job_title/job_profile), bio, and phone_number.
 * 3. Registered users retrieve authentic name and email directly from DB, isolated per session.
 * 4. Profile photo for new users defaults to neutral SVG avatar (/uploads/avatars/default-avatar.svg), not previous user's avatar.
 * 5. Multiple users have strictly isolated profile states.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

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
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
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

async function runProfileLeakTests() {
  console.log('==================================================================');
  console.log('🛡️ RUNNING TATADANA PROFILE DATA LEAKAGE & ISOLATION TEST SUITE');
  console.log('==================================================================');

  // Auto-start server if not already running
  try {
    await request({ path: '/api/state', method: 'GET' });
  } catch (e) {
    require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  // ------------------------------------------------------------------
  // Group 1: New User Registration Profile Initialization
  // ------------------------------------------------------------------
  console.log('\n▶ Group 1: New User Registration Clean State (Requirement 1 & 3)');

  const testPhone = '0878' + Math.floor(10000000 + Math.random() * 90000000);
  const testEmail = `user.${Date.now()}@tatadana.id`;
  const testName = 'Siti Nurhaliza';

  // 1. Request OTP
  const otpRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/send-whatsapp-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { phone_number: testPhone });
  const otpData = JSON.parse(otpRes.body);
  const receivedOtp = otpData.otp || otpData.simulated_code;

  // 2. Verify OTP
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/verify-whatsapp-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { phone_number: testPhone, otp: receivedOtp });

  // 3. Register user
  const regRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    full_name: testName,
    email: testEmail,
    phone_number: testPhone,
    job_profile: '',
    whatsapp_verified: true
  });

  assert(regRes.statusCode === 200 || regRes.statusCode === 201, `Register new user returns HTTP 200/201 (Got ${regRes.statusCode})`);
  const regData = JSON.parse(regRes.body);
  const newUserId = regData.user.id;
  assert(Boolean(newUserId), `New user ID generated: ${newUserId}`);

  // Check state immediately from persistent storage
  const profileDbPath = path.join(__dirname, 'data', 'user-profiles.json');
  assert(fs.existsSync(profileDbPath), 'data/user-profiles.json exists on disk');
  const allProfiles = JSON.parse(fs.readFileSync(profileDbPath, 'utf8'));
  const storedProfile = allProfiles[newUserId];

  assert(Boolean(storedProfile), `New user profile stored in data/user-profiles.json`);
  assert(storedProfile.full_name === testName, `Profile name matches registered real name: "${storedProfile.full_name}"`);
  assert(storedProfile.email === testEmail, `Profile email matches registered real email: "${storedProfile.email}"`);
  assert(storedProfile.job_title === '', `Profile job_title is completely EMPTY: "${storedProfile.job_title}"`);
  assert(storedProfile.job_profile === '', `Profile job_profile is completely EMPTY: "${storedProfile.job_profile}"`);
  assert(storedProfile.bio === '', `Profile bio is completely EMPTY: "${storedProfile.bio}"`);
  assert(storedProfile.phone_number === '', `Profile phone_number is completely EMPTY for form: "${storedProfile.phone_number}"`);
  assert(storedProfile.avatar_url === '/uploads/avatars/default-avatar.svg', `Avatar defaults to neutral SVG: "${storedProfile.avatar_url}"`);

  // ------------------------------------------------------------------
  // Group 2: Session Data Fetching & State Isolation (Requirement 2)
  // ------------------------------------------------------------------
  console.log('\n▶ Group 2: State Isolation & Authentic User Data Fetching (Requirement 2)');

  // Fetch state for new user
  const stateResNewUser = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/state?userId=${encodeURIComponent(newUserId)}`,
    method: 'GET',
    headers: { 'x-user-id': newUserId }
  });

  assert(stateResNewUser.statusCode === 200, `GET /api/state?userId=${newUserId} returns HTTP 200`);
  const stateDataNewUser = JSON.parse(stateResNewUser.body);
  assert(stateDataNewUser.user.id === newUserId, `State user ID matches: ${stateDataNewUser.user.id}`);
  assert(stateDataNewUser.user.full_name === testName, `State user name is authentic (${stateDataNewUser.user.full_name}) without dummy data`);
  assert(stateDataNewUser.user.email === testEmail, `State user email is authentic (${stateDataNewUser.user.email}) without dummy data`);
  assert(stateDataNewUser.user.job_profile === '' || stateDataNewUser.user.job_title === '', `State user job is empty`);
  assert(stateDataNewUser.user.bio === '', `State user bio is empty`);
  assert(stateDataNewUser.user.phone_number === '', `State user profile phone is empty`);
  assert(stateDataNewUser.user.avatar_url === '/uploads/avatars/default-avatar.svg', `State avatar is default neutral SVG`);

  // Fetch state for Budi Pratama (usr_tatadana_001)
  const stateResBudi = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/state?userId=usr_tatadana_001',
    method: 'GET',
    headers: { 'x-user-id': 'usr_tatadana_001' }
  });
  const stateDataBudi = JSON.parse(stateResBudi.body);
  assert(stateDataBudi.user.id === 'usr_tatadana_001', 'Budi Pratama user ID is usr_tatadana_001');
  assert(stateDataBudi.user.full_name === 'Budi Pratama', 'Budi Pratama name is authentic');
  assert(stateDataBudi.user.email === 'budi.pratama@tatadana.id', 'Budi Pratama email is authentic');

  // Verify that Budi's data did NOT overwrite or bleed into Siti's data
  const recheckStateSiti = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/state?userId=${encodeURIComponent(newUserId)}`,
    method: 'GET',
    headers: { 'x-user-id': newUserId }
  });
  const recheckDataSiti = JSON.parse(recheckStateSiti.body);
  assert(recheckDataSiti.user.full_name === testName, `Recheck: Siti's name is still authentic (${recheckDataSiti.user.full_name})`);
  assert(recheckDataSiti.user.email === testEmail, `Recheck: Siti's email is still authentic (${recheckDataSiti.user.email})`);
  assert(recheckDataSiti.user.bio === '', `Recheck: Siti's bio remained empty`);

  // ------------------------------------------------------------------
  // Group 3: Real Profile Updates for Target User
  // ------------------------------------------------------------------
  console.log('\n▶ Group 3: Isolated Profile Updates (Requirement 1 & 2)');

  const updateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/user/profile',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': newUserId
    }
  }, {
    userId: newUserId,
    full_name: 'Siti Nurhaliza S.E.',
    email: testEmail,
    phone_number: '087811223344',
    job_title: 'Senior Financial Analyst',
    bio: 'Fokus pada alokasi instrumen investasi dan dana darurat keluarga.',
    default_currency: 'IDR'
  });

  assert(updateRes.statusCode === 200, `POST /api/user/profile for ${newUserId} returns HTTP 200`);
  const updateData = JSON.parse(updateRes.body);
  assert(updateData.ok === true, 'Update response ok === true');
  assert(updateData.user.full_name === 'Siti Nurhaliza S.E.', `Updated name saved: ${updateData.user.full_name}`);
  assert(updateData.user.job_title === 'Senior Financial Analyst', `Updated job saved: ${updateData.user.job_title}`);
  assert(updateData.user.phone_number === '087811223344', `Updated phone saved: ${updateData.user.phone_number}`);

  // Confirm Budi Pratama's profile in DB was NOT changed
  const profilesAfter = JSON.parse(fs.readFileSync(profileDbPath, 'utf8'));
  assert(profilesAfter.usr_tatadana_001.full_name === 'Budi Pratama', "Budi Pratama's name remains unchanged");
  assert(profilesAfter[newUserId].full_name === 'Siti Nurhaliza S.E.', "Siti's updated name persisted in database file");

  // ------------------------------------------------------------------
  // Group 4: Default Avatar Asset & UI HTML Cleanliness
  // ------------------------------------------------------------------
  console.log('\n▶ Group 4: Default Avatar Asset & UI Cleanliness (Requirement 1 & 3)');

  const avatarSvgPath = path.join(__dirname, 'public', 'uploads', 'avatars', 'default-avatar.svg');
  assert(fs.existsSync(avatarSvgPath), 'Default avatar SVG file exists on disk');

  const avatarRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/uploads/avatars/default-avatar.svg',
    method: 'GET'
  });
  assert(avatarRes.statusCode === 200, 'GET /uploads/avatars/default-avatar.svg returns HTTP 200 OK');
  assert(avatarRes.headers['content-type'].includes('svg') || avatarRes.headers['content-type'].includes('xml'), `SVG Content-Type is valid (${avatarRes.headers['content-type']})`);

  // Verify index.html does not contain hardcoded phone '081234567890' in the profile form or sidebar
  const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  assert(!indexHtml.includes('id="set-prof-phone" value='), 'Profile phone input field does not have hardcoded value');
  assert(!indexHtml.includes('id="set-prof-name" value='), 'Profile name input field does not have hardcoded value');
  assert(!indexHtml.includes('id="set-prof-email" value='), 'Profile email input field does not have hardcoded value');

  console.log('\n==================================================================');
  console.log(`📊 PROFILE LEAK TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('==================================================================');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runProfileLeakTests().catch(err => {
  console.error('Unhandled error during test run:', err);
  process.exit(1);
});
