// ====================================================================
// Test Suite: Telegram Long Polling Integration & Localhost Support
// Verifies native Node.js Long Polling, status API, lifecycle, and backward compatibility
// ====================================================================

const http = require('http');
const assert = require('assert');
const path = require('path');
const telegramPolling = require('./src/modules/telegram-polling');

const PORT = 3000;
let passed = 0;
let total = 0;

function testAssert(cond, name) {
  total++;
  if (cond) {
    console.log(`✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${name}`);
  }
}

function reqApi(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: endpoint,
      method,
      headers: payload ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      } : {}
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
    if (payload) req.write(payload);
    req.end();
  });
}

async function runPollingTests() {
  console.log('🤖 RUNNING TELEGRAM LONG POLLING VERIFICATION SUITE...\n');

  // ----------------------------------------------------
  // Unit Tests: telegram-polling.js module
  // ----------------------------------------------------
  console.log('--- 1. Telegram Polling Module Unit Tests ---');
  testAssert(typeof telegramPolling.maskToken === 'function', 'maskToken is a function');
  testAssert(telegramPolling.maskToken('123456789:ABCdefGhIJKlmNoPQRstuVWxYz').includes('...'), 'maskToken hides sensitive middle characters');
  testAssert(typeof telegramPolling.TelegramPollingManager === 'function', 'TelegramPollingManager class exists');
  testAssert(telegramPolling.pollingManager !== null, 'Singleton pollingManager exists');

  const initialStatus = telegramPolling.pollingManager.getStatus();
  testAssert(initialStatus.ok === true && initialStatus.mode === 'long_polling', 'getStatus returns mode: long_polling');

  // Test custom polling manager start & stop lifecycle
  const customMgr = new telegramPolling.TelegramPollingManager();
  const startResult = await customMgr.start({
    botToken: '123456789:ABCdefGhIJKlmNoPQRstuVWxYz',
    db: { user: { id: 'usr_mock' } },
    messageHandler: async (upd) => ({ ok: true, reply_text: 'Echo: ' + upd.message.text })
  });
  testAssert(startResult.ok === true && startResult.mode === 'long_polling', 'customMgr.start returns ok: true with long_polling mode');
  testAssert(customMgr.isActive === true, 'customMgr is active after start');

  const stopResult = await customMgr.stop();
  testAssert(stopResult.ok === true && customMgr.isActive === false, 'customMgr.stop deactivates manager');

  // ----------------------------------------------------
  // Integration Tests: Server Endpoints
  // ----------------------------------------------------
  console.log('\n--- 2. Server API & Endpoints Integration Tests ---');

  // Test GET /api/telegram/status
  const statusRes = await reqApi('GET', '/api/telegram/status');
  testAssert(statusRes.status === 200, 'GET /api/telegram/status returns HTTP 200');
  testAssert(statusRes.data.mode === 'long_polling', 'Status mode is "long_polling"');
  testAssert(typeof statusRes.data.webhook_url === 'string', 'Status includes backward-compatible webhook_url');

  // Test POST /api/telegram/test-connection (Valid token)
  const testConnRes = await reqApi('POST', '/api/telegram/test-connection', {
    botToken: '849302194:AAHF1a9XmZ0kdq-38Z9eY14mKp03'
  });
  testAssert(testConnRes.status === 200, 'POST /api/telegram/test-connection returns HTTP 200');
  testAssert(testConnRes.data.status === 'connected', 'Status is "connected"');
  testAssert(testConnRes.data.mode === 'long_polling', 'Response mode is "long_polling"');
  testAssert(testConnRes.data.polling_active === true, 'polling_active is true');
  testAssert(testConnRes.data.webhook_url && testConnRes.data.webhook_url.includes('/api/telegram/webhook'), 'Backward-compatible webhook_url returned');

  // Test POST /api/telegram/test-connection (Invalid token)
  const invalidRes = await reqApi('POST', '/api/telegram/test-connection', {
    botToken: 'short_invalid'
  });
  testAssert(invalidRes.status === 400, 'Invalid token returns HTTP 400');
  testAssert(invalidRes.data.status === 'disconnected', 'Invalid token status is "disconnected"');

  // Test POST /api/telegram/polling/toggle
  const toggleStop = await reqApi('POST', '/api/telegram/polling/toggle', { action: 'stop' });
  testAssert(toggleStop.status === 200 && toggleStop.data.polling_active === false, 'POST /api/telegram/polling/toggle can stop polling');

  const toggleStart = await reqApi('POST', '/api/telegram/polling/toggle', {
    action: 'start',
    botToken: '849302194:AAHF1a9XmZ0kdq-38Z9eY14mKp03'
  });
  testAssert(toggleStart.status === 200 && toggleStart.data.polling_active === true, 'POST /api/telegram/polling/toggle can restart polling');

  // ----------------------------------------------------
  // End-to-End Processing Test via Webhook & Handlers
  // ----------------------------------------------------
  console.log('\n--- 3. Message Processing & Balance Update Tests ---');

  const testUid = Date.now();
  const txRes = await reqApi('POST', '/api/telegram/webhook', {
    update_id: testUid,
    message: {
      text: 'Makan siang nasi padang 28rb',
      from: { id: 11223344 }
    }
  });

  testAssert(txRes.status === 200, 'Incoming message processed with HTTP 200');
  testAssert(txRes.data.ok === true, 'Result ok: true');
  testAssert(txRes.data.reply_text && txRes.data.reply_text.includes('Pengeluaran tercatat!'), 'Reply text confirms pengeluaran tercatat');
  testAssert(txRes.data.transaction && txRes.data.transaction.amount === 28000, 'Transaction recorded with 28.000 nominal');

  // Verify Idempotency
  const dupRes = await reqApi('POST', '/api/telegram/webhook', {
    update_id: testUid,
    message: {
      text: 'Makan siang nasi padang 28rb',
      from: { id: 11223344 }
    }
  });
  testAssert(dupRes.data.skipped_reason === 'idempotent_duplicate', 'Duplicate update_id correctly skipped for idempotency');

  console.log(`\n====================================================`);
  console.log(`TELEGRAM POLLING SUITE RESULT: ${passed} / ${total} TESTS PASSED`);
  console.log(`====================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPollingTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runPollingTests };
