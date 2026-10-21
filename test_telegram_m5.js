// ====================================================================
// Test Suite: Milestone 5 (R5) Telegram Bot NLP & Webhook Hardening
// ====================================================================

const http = require('http');
const assert = require('assert');
const telegramNlp = require('./src/lib/telegram-nlp');

let updateIdCounter = 950000;
function nextUid() {
  return ++updateIdCounter;
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

async function runM5Tests() {
  console.log('🤖 RUNNING MILESTONE 5 (R5) TELEGRAM BOT NLP VERIFICATION...\n');

  try {
    await new Promise((res, rej) => {
      const r = http.get('http://localhost:3000/api/state', res);
      r.on('error', rej);
    });
  } catch (e) {
    require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  await post('/api/test/reset-state', {});
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

  // 1. Currency nominal parser
  testAssert(telegramNlp.parseIndonesianCurrency('beli 2 ayam geprek 25.000') === 25000, 'Parser extracts 25000 from "beli 2 ayam geprek 25.000" without digit-concatenation bug');
  testAssert(telegramNlp.parseIndonesianCurrency('beli 2 ayam geprek 25.500') === 25500, 'Parser extracts 25500 from "beli 2 ayam geprek 25.500"');
  testAssert(telegramNlp.parseIndonesianCurrency('beli 2 ayam 25000') === 25000, 'Parser extracts 25000 from "beli 2 ayam 25000" without digit-concatenation bug');
  testAssert(telegramNlp.parseIndonesianCurrency('beli 2 ayam 25rb') === 25000, 'Parser extracts 25000 from "beli 2 ayam 25rb"');
  testAssert(telegramNlp.parseIndonesianCurrency('beli 2 ayam 25k') === 25000, 'Parser extracts 25000 from "beli 2 ayam 25k"');
  testAssert(telegramNlp.parseIndonesianCurrency('makan 25.500') === 25500, 'Parser extracts 25500 from "makan 25.500"');
  testAssert(telegramNlp.parseIndonesianCurrency('gaji 12,5jt') === 12500000, 'Parser extracts 12500000 from "gaji 12,5jt"');
  testAssert(telegramNlp.parseIndonesianCurrency('gaji 12.5jt') === 12500000, 'Parser extracts 12500000 from "gaji 12.5jt"');
  testAssert(telegramNlp.parseIndonesianCurrency('gaji 12,5 juta') === 12500000, 'Parser extracts 12500000 from "gaji 12,5 juta"');
  testAssert(telegramNlp.parseIndonesianCurrency('gaji 12.5 juta') === 12500000, 'Parser extracts 12500000 from "gaji 12.5 juta"');
  testAssert(telegramNlp.parseIndonesianCurrency('beli pulsa 50rb') === 50000, 'Parser extracts 50000 from "beli pulsa 50rb"');
  testAssert(telegramNlp.parseIndonesianCurrency('beli pulsa 50 ribu') === 50000, 'Parser extracts 50000 from "beli pulsa 50 ribu"');
  testAssert(telegramNlp.parseIndonesianCurrency('beli pulsa 50k') === 50000, 'Parser extracts 50000 from "beli pulsa 50k"');
  testAssert(telegramNlp.parseIndonesianCurrency('bayar kos 1.500.000') === 1500000, 'Parser extracts 1500000 from "bayar kos 1.500.000"');
  testAssert(telegramNlp.parseIndonesianCurrency('Rp 25.000') === 25000, 'Parser extracts 25000 from "Rp 25.000"');
  testAssert(telegramNlp.parseIndonesianCurrency('Rp 500') === 500, 'Parser extracts 500 from "Rp 500"');
  testAssert(telegramNlp.parseIndonesianCurrency('500 perak') === 500, 'Parser extracts 500 from "500 perak"');
  testAssert(telegramNlp.parseIndonesianCurrency('halo selamat pagi') === null, 'Parser returns null for non-currency text');

  // 2. Income Inversion Bug Fix
  testAssert(telegramNlp.isSalaryExpense('gaji supir 1.5jt') === true, 'isSalaryExpense returns true for "gaji supir 1.5jt"');
  testAssert(telegramNlp.isSalaryExpense('bayar gaji pembantu 2jt') === true, 'isSalaryExpense returns true for "bayar gaji pembantu 2jt"');
  testAssert(telegramNlp.isSalaryExpense('bayar gaji supir 1.5jt') === true, 'isSalaryExpense returns true for "bayar gaji supir 1.5jt"');
  testAssert(telegramNlp.isSalaryExpense('gaji karyawan 3.5jt') === true, 'isSalaryExpense returns true for "gaji karyawan 3.5jt"');
  testAssert(telegramNlp.isSalaryExpense('gaji 12,5jt') === false, 'isSalaryExpense returns false for "gaji 12,5jt" (income)');
  testAssert(telegramNlp.isSalaryExpense('gajian kantor 9.5jt') === false, 'isSalaryExpense returns false for "gajian kantor 9.5jt" (income)');

  const c1 = telegramNlp.categorizeTelegramMessage('gaji supir 1.5jt');
  testAssert(c1.type === 'expense' && c1.nominal === 1500000, 'Categorization: "gaji supir 1.5jt" is expense with 1500000');
  testAssert(c1.categoryName === 'Tagihan & Utilitas', 'Categorization: "gaji supir 1.5jt" mapped to Tagihan & Utilitas');

  const c2 = telegramNlp.categorizeTelegramMessage('bayar gaji pembantu 2jt');
  testAssert(c2.type === 'expense' && c2.nominal === 2000000, 'Categorization: "bayar gaji pembantu 2jt" is expense with 2000000');

  const c3 = telegramNlp.categorizeTelegramMessage('gaji 12,5jt');
  testAssert(c3.type === 'income' && c3.nominal === 12500000, 'Categorization: "gaji 12,5jt" is income with 12500000');

  // 3. Anti-Silent Misclassification
  const c4 = telegramNlp.categorizeTelegramMessage('potong rambut 35rb');
  testAssert(c4.type === 'expense' && c4.categoryName === 'Lain-lain', 'Categorization: "potong rambut 35rb" falls back to Lain-lain (not Makanan & Minuman)');

  const c5 = telegramNlp.categorizeTelegramMessage('beli semen 50rb');
  testAssert(c5.categoryName === 'Lain-lain', 'Categorization: "beli semen 50rb" falls back to Lain-lain (not Makanan & Minuman)');

  const c6 = telegramNlp.categorizeTelegramMessage('beli nasi padang rendang 25rb');
  testAssert(c6.categoryName === 'Makanan & Minuman', 'Categorization: actual food mapped to Makanan & Minuman');

  // 4. Webhook HTTP Integration & Idempotency
  try {
    const res1 = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'gaji supir 1.5jt' }
    });
    testAssert(res1.status === 200 && res1.data.transaction && res1.data.transaction.type === 'expense', 'Webhook HTTP: "gaji supir 1.5jt" processed as expense');
    testAssert(res1.data.transaction.amount === 1500000, 'Webhook HTTP: amount is 1500000');
    testAssert(res1.data.reply_text.includes('Pengeluaran tercatat!'), 'Webhook HTTP: reply indicates Pengeluaran tercatat');

    const res2 = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'beli 2 ayam geprek 25.000' }
    });
    testAssert(res2.data.transaction.amount === 25000, 'Webhook HTTP: "beli 2 ayam geprek 25.000" amount is exactly 25000');

    // Missing update_id protection
    const noUid1 = await post('/api/telegram/webhook', {
      message: { text: 'Bayar iuran kebersihan RT 30rb' }
    });
    testAssert(noUid1.status === 200 && noUid1.data.transaction, 'Webhook HTTP: missing update_id first call accepted');

    const noUid2 = await post('/api/telegram/webhook', {
      message: { text: 'Bayar iuran kebersihan RT 30rb' }
    });
    testAssert(noUid2.data.skipped_reason === 'idempotent_duplicate', 'Webhook HTTP: missing update_id duplicate call blocked (no bypass)');

    // Semantic fingerprint window protection
    const sem1 = await post('/api/telegram/webhook', {
      update_id: nextUid(),
      message: { text: 'Beli voucher game 75rb' }
    });
    testAssert(sem1.status === 200 && sem1.data.transaction, 'Webhook HTTP: semantic window test first call accepted');

    const sem2 = await post('/api/telegram/webhook', {
      update_id: nextUid(), // Different update_id
      message: { text: 'Beli voucher game 75rb' }
    });
    testAssert(sem2.data.skipped_reason === 'idempotent_duplicate', 'Webhook HTTP: semantic duplicate with different update_id blocked within 60s');
  } catch (e) {
    testAssert(false, 'Webhook HTTP integration: ' + e.message);
  }

  console.log(`\n========================================`);
  console.log(`📊 M5 TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runM5Tests();
