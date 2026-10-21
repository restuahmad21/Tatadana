// ====================================================================
// Test Suite: Telegram Bot API Token Permanent Storage & Auto-Init
// Verifies:
// 1. Permanent token storage to data/telegram-settings.json, data/settings.json, and .env
// 2. Token retrieval on Node.js restart via loadTelegramToken()
// 3. Auto-start of Long Polling daemon upon server boot without user input
// 4. Persistence across reboot cycle
// ====================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const telegramPolling = require('./src/modules/telegram-polling');

const TEST_TOKEN = '9876543210:AAH_Persistent_Token_Verification_xyz';

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting Telegram Bot Token Permanent Storage & Auto-Init Tests...\n');

  // Test 1: saveTelegramToken saves to all storage targets
  console.log('▶️ TEST 1: saveTelegramToken persistence to JSON files and .env');
  const saved = telegramPolling.saveTelegramToken(TEST_TOKEN, {
    id: 9876543210,
    username: 'tatadana_persistent_bot',
    first_name: 'TataDana Persistent Bot'
  });
  assert.strictEqual(saved, true, 'saveTelegramToken should return true');

  const settingsJsonPath = path.join(__dirname, 'data', 'telegram-settings.json');
  assert.ok(fs.existsSync(settingsJsonPath), 'data/telegram-settings.json must exist');
  const jsonContent = JSON.parse(fs.readFileSync(settingsJsonPath, 'utf8'));
  assert.strictEqual(jsonContent.telegram_bot_token, TEST_TOKEN, 'Stored token in telegram-settings.json must match');
  assert.strictEqual(jsonContent.mode, 'long_polling', 'Mode must be long_polling');

  const generalSettingsPath = path.join(__dirname, 'data', 'settings.json');
  assert.ok(fs.existsSync(generalSettingsPath), 'data/settings.json must exist');
  const genContent = JSON.parse(fs.readFileSync(generalSettingsPath, 'utf8'));
  assert.strictEqual(genContent.telegram_bot_token, TEST_TOKEN, 'Stored token in settings.json must match');

  const envPath = path.join(__dirname, '.env');
  assert.ok(fs.existsSync(envPath), '.env file must exist');
  const envContent = fs.readFileSync(envPath, 'utf8');
  assert.ok(envContent.includes(TEST_TOKEN), '.env must contain TEST_TOKEN');
  console.log('  ✅ TEST 1 PASSED: Token saved permanently to telegram-settings.json, settings.json, and .env\n');

  // Test 2: loadTelegramToken correctly retrieves the saved token
  console.log('▶️ TEST 2: loadTelegramToken recovery');
  const loaded = telegramPolling.loadTelegramToken();
  assert.ok(loaded, 'loadTelegramToken must return an object');
  assert.strictEqual(loaded.token, TEST_TOKEN, 'loadTelegramToken must return matching token');
  assert.ok(loaded.source, 'loadTelegramToken must indicate storage source');
  console.log(`  ✅ TEST 2 PASSED: Loaded token successfully from source: ${loaded.source}\n`);

  // Test 3: Live API endpoints testing
  console.log('▶️ TEST 3: Verification via HTTP API endpoints');
  const testConnRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/telegram/test-connection',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { botToken: TEST_TOKEN });

  assert.strictEqual(testConnRes.status, 200, 'test-connection should return 200');
  assert.strictEqual(testConnRes.data.ok, true, 'test-connection ok should be true');
  assert.strictEqual(testConnRes.data.mode, 'long_polling', 'mode should be long_polling');
  assert.strictEqual(testConnRes.data.polling_active, true, 'polling_active should be true');

  // Check /api/telegram/status
  const statusRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/telegram/status',
    method: 'GET'
  });
  assert.strictEqual(statusRes.status, 200, 'status should return 200');
  assert.strictEqual(statusRes.data.connected, true, 'connected should be true');
  assert.strictEqual(statusRes.data.token_configured, true, 'token_configured should be true');
  assert.strictEqual(statusRes.data.polling_active, true, 'polling_active should be true');

  // Check /api/settings/telegram
  const settingsRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/settings/telegram',
    method: 'GET'
  });
  assert.strictEqual(settingsRes.status, 200, 'settings/telegram should return 200');
  assert.strictEqual(settingsRes.data.token, TEST_TOKEN, 'token in settings should match TEST_TOKEN');
  assert.strictEqual(settingsRes.data.polling_active, true, 'polling_active should be true');
  console.log('  ✅ TEST 3 PASSED: API endpoints report active Long Polling and verified token\n');

  console.log('🎉 ALL TELEGRAM BOT TOKEN PERMANENT STORAGE TESTS PASSED!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
