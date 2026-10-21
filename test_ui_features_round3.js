/**
 * Test Suite: UI Features Round 3
 * 1. Beranda dynamic period filter (daily, weekly, monthly, yearly, custom range)
 * 2. Laporan Export Excel (.xlsx) using xlsx library (client-side + backend streaming)
 * 3. Budget subtab 'Atur Budget' modal & category limit management (POST /api/budgets)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

async function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let body = null;
        try {
          body = JSON.parse(buffer.toString('utf8'));
        } catch (e) {
          body = buffer;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          rawBuffer: buffer
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      if (typeof postData === 'object' && !Buffer.isBuffer(postData)) {
        req.write(JSON.stringify(postData));
      } else {
        req.write(postData);
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 TEST SUITE: UI FEATURES ROUND 3');
  console.log('======================================================\n');

  // Auto-start server if not already running
  try {
    await request({ hostname: 'localhost', port: 3000, path: '/api/state', method: 'GET' });
  } catch (e) {
    require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  // ------------------------------------------------------------------
  // TIER 1: HTML & Markup Structure Verification
  // ------------------------------------------------------------------
  console.log('--- [TIER 1] HTML & MARKUP STRUCTURE VERIFICATION ---');
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const htmlContent = fs.readFileSync(indexPath, 'utf8');

  // Check SheetJS vendor file
  const vendorXlsx = path.join(__dirname, 'public', 'vendor', 'xlsx.full.min.js');
  assert(fs.existsSync(vendorXlsx), 'Vendor SheetJS xlsx.full.min.js exists in public/vendor');
  assert(htmlContent.includes('/vendor/xlsx.full.min.js'), 'index.html includes SheetJS script tag');

  // Check Beranda Period Filter Elements
  assert(htmlContent.includes('id="btn-period-monthly"'), 'Beranda contains #btn-period-monthly');
  assert(htmlContent.includes('id="btn-period-daily"'), 'Beranda contains #btn-period-daily');
  assert(htmlContent.includes('id="btn-period-weekly"'), 'Beranda contains #btn-period-weekly');
  assert(htmlContent.includes('id="btn-period-yearly"'), 'Beranda contains #btn-period-yearly');
  assert(htmlContent.includes('id="btn-period-custom"'), 'Beranda contains #btn-period-custom');
  assert(htmlContent.includes('id="overview-custom-range-container"'), 'Beranda contains #overview-custom-range-container');
  assert(htmlContent.includes('id="overview-start-date"'), 'Beranda contains #overview-start-date');
  assert(htmlContent.includes('id="overview-end-date"'), 'Beranda contains #overview-end-date');

  // Check Donut Chart & Overview Stats Elements
  assert(htmlContent.includes('id="overview-donut-svg"'), 'Beranda contains #overview-donut-svg');
  assert(htmlContent.includes('id="overview-donut-legend"'), 'Beranda contains #overview-donut-legend');
  assert(htmlContent.includes('id="overview-donut-period-label"'), 'Beranda contains #overview-donut-period-label');
  assert(htmlContent.includes('id="stat-income-title"'), 'Beranda contains #stat-income-title');
  assert(htmlContent.includes('id="stat-expense-title"'), 'Beranda contains #stat-expense-title');
  assert(htmlContent.includes('id="stat-budget-title"'), 'Beranda contains #stat-budget-title');

  // Check Export Excel Button
  assert(htmlContent.includes('id="btn-export-excel"'), 'Laporan tab contains #btn-export-excel');
  assert(htmlContent.includes('onclick="exportTransactionsExcel()"'), '#btn-export-excel binds to exportTransactionsExcel()');

  // Check Atur Budget Button & Modal
  assert(htmlContent.includes('id="btn-open-manage-budget"'), 'Budget tab contains #btn-open-manage-budget');
  assert(htmlContent.includes('onclick="openManageBudgetModal()"'), '#btn-open-manage-budget binds to openManageBudgetModal()');
  assert(htmlContent.includes('id="modal-manage-budget"'), 'Markup contains #modal-manage-budget');
  assert(htmlContent.includes('id="manage-budget-categories-list"'), 'Modal contains #manage-budget-categories-list');
  assert(htmlContent.includes('id="btn-save-manage-budget"'), 'Modal contains #btn-save-manage-budget');
  assert(htmlContent.includes('onclick="saveManagedBudgets()"'), '#btn-save-manage-budget binds to saveManagedBudgets()');

  // ------------------------------------------------------------------
  // TIER 2: Client-side Script Logic & Syntax Checks
  // ------------------------------------------------------------------
  console.log('\n--- [TIER 2] CLIENT-SIDE SCRIPT LOGIC & SYNTAX ---');
  
  // Extract and validate all script blocks
  const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match;
  let inlineScriptCount = 0;
  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const code = match[1].trim();
    if (code.length > 0) {
      inlineScriptCount++;
      try {
        new Function(code);
        assert(true, `Inline script block #${inlineScriptCount} compiles without syntax errors`);
      } catch (err) {
        assert(false, `Inline script block #${inlineScriptCount} syntax error: ${err.message}`);
      }
    }
  }

  // Check presence of required functions in script
  assert(htmlContent.includes('function setOverviewPeriod('), 'Client script defines setOverviewPeriod()');
  assert(htmlContent.includes('function applyOverviewCustomRange('), 'Client script defines applyOverviewCustomRange()');
  assert(htmlContent.includes('function renderOverviewPeriodData('), 'Client script defines renderOverviewPeriodData()');
  assert(htmlContent.includes('function exportTransactionsExcel('), 'Client script defines exportTransactionsExcel()');
  assert(htmlContent.includes('function openManageBudgetModal('), 'Client script defines openManageBudgetModal()');
  assert(htmlContent.includes('function closeManageBudgetModal('), 'Client script defines closeManageBudgetModal()');
  assert(htmlContent.includes('function saveManagedBudgets('), 'Client script defines saveManagedBudgets()');

  // ------------------------------------------------------------------
  // TIER 3: Backend Excel Export API Verification
  // ------------------------------------------------------------------
  console.log('\n--- [TIER 3] BACKEND EXCEL EXPORT API VERIFICATION ---');
  
  const XLSX = require('xlsx');

  const excelRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reports/export/excel?format=xlsx',
    method: 'GET'
  });

  assert(excelRes.statusCode === 200, `GET /api/reports/export/excel returns 200 (Got ${excelRes.statusCode})`);
  assert(
    excelRes.headers['content-type'] === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    `Content-Type is valid OpenXML .xlsx (Got ${excelRes.headers['content-type']})`
  );
  assert(
    excelRes.headers['content-disposition'] && excelRes.headers['content-disposition'].includes('.xlsx'),
    'Content-Disposition header specifies .xlsx attachment'
  );

  // Parse binary buffer with SheetJS
  let parsedWb = null;
  try {
    parsedWb = XLSX.read(excelRes.rawBuffer, { type: 'buffer' });
  } catch (err) {
    console.error('Error parsing xlsx buffer:', err);
  }
  assert(parsedWb !== null, 'Workbook buffer is readable by SheetJS parser');
  assert(parsedWb && parsedWb.SheetNames && parsedWb.SheetNames.length > 0, `Workbook contains sheet: ${parsedWb ? parsedWb.SheetNames[0] : 'none'}`);

  const firstSheet = parsedWb ? parsedWb.Sheets[parsedWb.SheetNames[0]] : null;
  assert(firstSheet !== null, 'Transaction worksheet exists');
  const sheetData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
  assert(sheetData.length >= 6, `Worksheet has structured data rows (Row count: ${sheetData.length})`);
  
  const foundHeader = sheetData.some(row => Array.isArray(row) && row.includes('No') && row.includes('Kategori') && row.includes('Nominal (Rp)'));
  assert(foundHeader, 'Worksheet contains required table headers: No, Kategori, Nominal (Rp)');

  // ------------------------------------------------------------------
  // TIER 4: Backend Budget Management (POST /api/budgets)
  // ------------------------------------------------------------------
  console.log('\n--- [TIER 4] BACKEND BUDGET MANAGEMENT API VERIFICATION ---');

  // Single category budget update
  const singleBudgetRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/budgets',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    category_id: 'cat_makanan',
    category_name: 'Makanan & Minuman',
    monthly_limit: 3500000
  });

  assert(singleBudgetRes.statusCode === 200, `POST /api/budgets (single) returns 200 (Got ${singleBudgetRes.statusCode})`);
  assert(singleBudgetRes.body && singleBudgetRes.body.ok === true, 'Single budget update returns ok: true');
  const updatedBudgets = singleBudgetRes.body.budgets || [];
  const foodBudget = updatedBudgets.find(b => b.category_id === 'cat_makanan' || (b.category_name && b.category_name.includes('Makanan')));
  assert(foodBudget && foodBudget.monthly_limit === 3500000, `Food budget monthly_limit updated to 3.500.000 (Got ${foodBudget ? foodBudget.monthly_limit : 'none'})`);

  // Batch budget update
  const batchBudgetRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/budgets',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    budgets: [
      { category_id: 'cat_transport', monthly_limit: 1200000, category_name: 'Transportasi' },
      { category_id: 'cat_bills', monthly_limit: 2000000, category_name: 'Tagihan & Utilitas' }
    ]
  });

  assert(batchBudgetRes.statusCode === 200, `POST /api/budgets (batch) returns 200 (Got ${batchBudgetRes.statusCode})`);
  assert(batchBudgetRes.body && batchBudgetRes.body.ok === true, 'Batch budget update returns ok: true');
  const transportBudget = (batchBudgetRes.body.budgets || []).find(b => b.category_id === 'cat_transport' || (b.category_name && b.category_name.includes('Transport')));
  assert(transportBudget && transportBudget.monthly_limit === 1200000, `Transport budget updated to 1.200.000 (Got ${transportBudget ? transportBudget.monthly_limit : 'none'})`);

  // ------------------------------------------------------------------
  // TIER 5: In-Memory Period Calculation Emulation
  // ------------------------------------------------------------------
  console.log('\n--- [TIER 5] IN-MEMORY PERIOD CALCULATION SIMULATION ---');

  const budgetPeriodModule = require('./public/modules/budget-period.js');
  const sampleTransactions = [
    { id: '1', type: 'income', amount: 10000000, transaction_date: '2026-10-01T08:00:00+07:00', note: 'Gaji Bulanan' },
    { id: '2', type: 'expense', amount: 50000, transaction_date: new Date().toISOString(), category_id: 'cat_food', category_name: 'Makanan & Minuman' },
    { id: '3', type: 'expense', amount: 150000, transaction_date: new Date(Date.now() - 2 * 86400000).toISOString(), category_id: 'cat_food', category_name: 'Makanan & Minuman' },
    { id: '4', type: 'expense', amount: 500000, transaction_date: new Date(Date.now() - 15 * 86400000).toISOString(), category_id: 'cat_food', category_name: 'Makanan & Minuman' }
  ];

  const testBudget = { category_id: 'cat_food', category_name: 'Makanan & Minuman', monthly_limit: 3000000 };

  const dailyResult = budgetPeriodModule.calculateCategoryBudgetPeriod(testBudget, sampleTransactions, 'daily');
  assert(dailyResult.limit === 100000, `Daily limit is 100.000 (3.000.000 / 30) (Got ${dailyResult.limit})`);
  assert(dailyResult.spent === 50000, `Daily spent includes only today's expense (50.000) (Got ${dailyResult.spent})`);
  assert(dailyResult.remaining === 50000, `Daily remaining is 50.000 (Got ${dailyResult.remaining})`);

  const weeklyResult = budgetPeriodModule.calculateCategoryBudgetPeriod(testBudget, sampleTransactions, 'weekly');
  assert(weeklyResult.limit === 750000, `Weekly limit is 750.000 (3.000.000 / 4) (Got ${weeklyResult.limit})`);
  assert(weeklyResult.spent === 200000, `Weekly spent includes last 7 days (50.000 + 150.000 = 200.000) (Got ${weeklyResult.spent})`);
  assert(weeklyResult.remaining === 550000, `Weekly remaining is 550.000 (Got ${weeklyResult.remaining})`);

  const monthlyResult = budgetPeriodModule.calculateCategoryBudgetPeriod(testBudget, sampleTransactions, 'monthly');
  assert(monthlyResult.limit === 3000000, `Monthly limit equals full limit 3.000.000 (Got ${monthlyResult.limit})`);
  assert(monthlyResult.spent >= 700000, `Monthly spent includes full month expenses (Got ${monthlyResult.spent})`);

  // Final summary
  console.log('\n======================================================');
  console.log(`📊 ROUND 3 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('======================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
