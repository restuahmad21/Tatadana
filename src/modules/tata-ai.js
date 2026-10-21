// ====================================================================
// TataDana Fintech SaaS: Tata AI In-App Intelligent Financial Advisor
// Module: src/modules/tata-ai.js
// Genuine Contextual Financial Analysis & Simulation Engine
// ====================================================================

function formatRupiah(num) {
  const n = Math.round(Number(num) || 0);
  return 'Rp' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Robust Indonesian Currency & Nominal Parser
 * Handles: '35rb', '50k', '2,5jt', '12.5jt', '25.000', '1.500.000', '50000', etc.
 */
function parseIndonesianNominal(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim();

  // 1. Million format: '2.5jt', '12,5jt', '2jt', '5 juta'
  const jtMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)\b/i);
  if (jtMatch) {
    const val = parseFloat(jtMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1000000);
  }

  // 2. Thousand format: '35rb', '25.5rb', '50k', '100ribu'
  const rbMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
  if (rbMatch) {
    const val = parseFloat(rbMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1000);
  }

  // 3. Dot separated: '1.500.000' or '25.000'
  const dotMatch = clean.match(/(?:rp\.?\s*|idr\s*)?(\d{1,3}(?:\.\d{3})+)/i);
  if (dotMatch) {
    const val = parseInt(dotMatch[1].replace(/\./g, ''), 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 4. Rp followed by plain digits: 'Rp50000'
  const rpMatch = clean.match(/(?:rp\.?\s*|idr\s*)(\d+)/i);
  if (rpMatch) {
    const val = parseInt(rpMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 5. Plain number of 4+ digits: '50000'
  const numMatch = clean.match(/\b(\d{4,})\b/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

/**
 * Escape HTML to prevent injection
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format user wallets list into natural Indonesian options:
 * e.g. "Cash, BCA, atau DANA"
 */
function formatWalletOptionsText(wallets) {
  if (!Array.isArray(wallets) || wallets.length === 0) {
    return 'Cash, BCA, atau DANA';
  }
  const labels = [];
  const seen = new Set();
  for (const w of wallets) {
    let label = '';
    if (w.type === 'cash') {
      label = 'Cash';
    } else if (w.institution_name) {
      label = w.institution_name;
    } else {
      const lower = (w.name || '').toLowerCase();
      if (lower.includes('cash') || lower.includes('tunai')) label = 'Cash';
      else label = w.name;
    }
    if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      labels.push(label);
    }
  }

  if (labels.length === 0) return 'Cash, BCA, atau DANA';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} atau ${labels[1]}`;
  const last = labels[labels.length - 1];
  const others = labels.slice(0, -1).join(', ');
  return `${others}, atau ${last}`;
}

/**
 * Find matching wallet from user reply
 */
function findWalletByUserInput(input, wallets) {
  if (!input || !Array.isArray(wallets) || wallets.length === 0) return null;
  const raw = String(input).toLowerCase().trim();
  const clean = raw
    .replace(/[👛💳🏦💰💵📱]/g, '')
    .replace(/\b(pakai|pake|dari|lewat|gunakan|dompet|rekening|akun|bank|saldo|aja|deh|dong)\b/gi, '')
    .trim();

  // 1. Exact match on institution_name, name, or clean
  for (const w of wallets) {
    const inst = (w.institution_name || '').toLowerCase().trim();
    const name = (w.name || '').toLowerCase().trim();
    const type = (w.type || '').toLowerCase().trim();

    if (inst && (clean === inst || raw === inst)) return w;
    if (name && (clean === name || raw === name)) return w;
    if (type === 'cash' && (clean === 'cash' || clean === 'tunai' || raw === 'cash' || raw === 'tunai')) return w;
  }

  // 2. Word boundary or contains match
  for (const w of wallets) {
    const inst = (w.institution_name || '').toLowerCase().trim();
    const name = (w.name || '').toLowerCase().trim();
    const type = (w.type || '').toLowerCase().trim();

    if (inst && new RegExp(`\\b${inst}\\b`, 'i').test(raw)) return w;
    if (name && new RegExp(`\\b${name}\\b`, 'i').test(raw)) return w;
    if (type === 'cash' && (/\bcash\b/i.test(raw) || /\btunai\b/i.test(raw) || /\bfisik\b/i.test(raw))) return w;
  }

  // 3. Substring match
  for (const w of wallets) {
    const inst = (w.institution_name || '').toLowerCase().trim();
    const name = (w.name || '').toLowerCase().trim();
    const type = (w.type || '').toLowerCase().trim();

    if (inst && (raw.includes(inst) || inst.includes(clean))) return w;
    if (name && (raw.includes(name) || name.includes(clean))) return w;
    if (type === 'cash' && (raw.includes('cash') || raw.includes('tunai'))) return w;
  }

  return null;
}

/**
 * Extract expense details: nominal, categoryName, categoryEmoji, categoryId, note
 */
function extractExpenseDetails(text, dbState) {
  const nominal = parseIndonesianNominal(text);
  const lower = (text || '').toLowerCase().trim();

  let categoryName = 'Lain-lain';
  let categoryEmoji = '💸';

  if (
    lower.includes('makan') || lower.includes('minum') || lower.includes('kopi') ||
    lower.includes('bakso') || lower.includes('sate') || lower.includes('padang') ||
    lower.includes('mie') || lower.includes('nasgor') || lower.includes('ayam') ||
    lower.includes('nasi') || lower.includes('resto') || lower.includes('cafe') ||
    lower.includes('kafe') || lower.includes('teh') || lower.includes('snack') ||
    lower.includes('cemilan') || lower.includes('roti') || lower.includes('sarapan') ||
    lower.includes('lunch') || lower.includes('dinner') || lower.includes('warung') ||
    lower.includes('geprek') || lower.includes('bebek') || lower.includes('soto') ||
    lower.includes('rawon') || lower.includes('pizza') || lower.includes('burger') ||
    lower.includes('boba') || lower.includes('jus') || lower.includes('kuliner') ||
    lower.includes('jajan') || lower.includes('rendang') || lower.includes('siomay') ||
    lower.includes('batagor') || lower.includes('martabak') || lower.includes('donat')
  ) {
    categoryName = 'Makanan & Minuman';
    categoryEmoji = '🍜';
  } else if (
    lower.includes('bensin') || lower.includes('pertamax') || lower.includes('pertalite') ||
    lower.includes('solar') || lower.includes('bbm') || lower.includes('gojek') ||
    lower.includes('grab') || lower.includes('parkir') || lower.includes('tol') ||
    lower.includes('kereta') || lower.includes('krl') || lower.includes('mrt') ||
    lower.includes('lrt') || lower.includes('ojol') || lower.includes('taksi') ||
    lower.includes('taxi') || lower.includes('motor') || lower.includes('mobil') ||
    lower.includes('busway') || lower.includes('transjakarta') || lower.includes('angkot') ||
    lower.includes('servis') || lower.includes('oli')
  ) {
    categoryName = 'Transportasi';
    categoryEmoji = '🚗';
  } else if (
    lower.includes('nonton') || lower.includes('bioskop') || lower.includes('xxi') ||
    lower.includes('cgv') || lower.includes('game') || lower.includes('steam') ||
    lower.includes('netflix') || lower.includes('spotify') || lower.includes('youtube') ||
    lower.includes('liburan') || lower.includes('karaoke') || lower.includes('hobi') ||
    lower.includes('staycation') || lower.includes('konser') || lower.includes('wisata')
  ) {
    categoryName = 'Hiburan & Lifestyle';
    categoryEmoji = '🎮';
  } else if (
    lower.includes('listrik') || lower.includes('pln') || lower.includes('wifi') ||
    lower.includes('indihome') || lower.includes('biznet') || lower.includes('pulsa') ||
    lower.includes('paket data') || lower.includes('kuota') || lower.includes('air') ||
    lower.includes('pdam') || lower.includes('iuran') || lower.includes('tagihan') ||
    lower.includes('bpjs') || lower.includes('sewa') || lower.includes('kos') ||
    lower.includes('kontrakan') || lower.includes('kebersihan') || lower.includes('supir') ||
    lower.includes('sopir') || lower.includes('pembantu') || lower.includes('art')
  ) {
    categoryName = 'Tagihan & Utilitas';
    categoryEmoji = '🏠';
  } else if (
    lower.includes('obat') || lower.includes('apotek') || lower.includes('apotik') ||
    lower.includes('vitamin') || lower.includes('dokter') || lower.includes('klinik') ||
    lower.includes('rs') || lower.includes('rumah sakit') || lower.includes('kesehatan') ||
    lower.includes('medis') || lower.includes('masker')
  ) {
    categoryName = 'Kesehatan & Obat';
    categoryEmoji = '💊';
  } else if (
    lower.includes('baju') || lower.includes('sepatu') || lower.includes('indomaret') ||
    lower.includes('alfamart') || lower.includes('supermarket') || lower.includes('belanja') ||
    lower.includes('shopee') || lower.includes('tokopedia') || lower.includes('tokped') ||
    lower.includes('lazada') || lower.includes('mall') || lower.includes('tas') ||
    lower.includes('celana') || lower.includes('skincare')
  ) {
    categoryName = 'Belanja & Groceries';
    categoryEmoji = '👕';
  } else if (
    lower.includes('buku') || lower.includes('kursus') || lower.includes('seminar') ||
    lower.includes('les') || lower.includes('kuliah') || lower.includes('sekolah') ||
    lower.includes('spp') || lower.includes('edukasi') || lower.includes('training')
  ) {
    categoryName = 'Buku & Edukasi';
    categoryEmoji = '📚';
  }

  let categoryId = 'cat_lain';
  if (dbState && Array.isArray(dbState.categories)) {
    const found = dbState.categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (found) {
      categoryId = found.id;
      categoryEmoji = found.emoji || categoryEmoji;
    }
  }

  let cleanNote = text
    .replace(/(?:rp\.?\s*|idr\s*)?\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k)?/gi, '')
    .replace(/\b(?:rp\.?|idr)\b/gi, '')
    .replace(/^(?:catat|catatkan|input|tambah|masukkan|tambahkan)\s+/i, '')
    .trim();
  if (!cleanNote) cleanNote = text.trim();

  return {
    nominal,
    categoryName,
    categoryEmoji,
    categoryId,
    note: cleanNote
  };
}

/**
 * Deep Financial Analytics derived from live database state
 */
function analyzeFinancials(dbState) {
  const transactions = (dbState && dbState.transactions) ? dbState.transactions : [];
  const budgets = (dbState && dbState.budgets) ? dbState.budgets : [];
  const wallets = (dbState && dbState.wallets) ? dbState.wallets : [];
  const user = (dbState && dbState.user) ? dbState.user : { full_name: 'Pengguna TataDana' };

  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryMap = {};
  const expenseTransactions = [];

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
    } else if (tx.type === 'expense') {
      totalExpenses += amt;
      expenseTransactions.push(tx);
      const catName = tx.category_name || 'Lain-lain';
      if (!categoryMap[catName]) {
        categoryMap[catName] = {
          name: catName,
          emoji: tx.category_emoji || '💳',
          total: 0,
          count: 0
        };
      }
      categoryMap[catName].total += amt;
      categoryMap[catName].count += 1;
    }
  }

  const categoryList = Object.values(categoryMap).sort((a, b) => b.total - a.total);
  categoryList.forEach(c => {
    c.percentage = totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 100) : 0;
  });

  const netCashflow = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netCashflow / totalIncome) * 100) : 0;

  // Budget Analysis
  const budgetStatusList = budgets.map(b => {
    const spent = Number(b.current_spent) || 0;
    const limit = Number(b.monthly_limit) || 1;
    const pct = Math.round((spent / limit) * 100);
    return {
      id: b.id,
      category_id: b.category_id,
      category_name: b.category_name,
      category_emoji: b.category_emoji || '🎯',
      monthly_limit: limit,
      current_spent: spent,
      remaining: Math.max(0, limit - spent),
      percentage: pct,
      isOver: pct >= 100,
      isWarning: pct >= 80 && pct < 100,
      isSafe: pct < 80
    };
  });

  const overBudgetCategories = budgetStatusList.filter(b => b.isOver);
  const warningBudgetCategories = budgetStatusList.filter(b => b.isWarning);

  // Wallets summary
  const totalLiquidBalance = wallets.filter(w => w.is_active !== false).reduce((sum, w) => sum + (Number(w.balance) || 0), 0);
  const defaultWallet = wallets.find(w => w.is_default && w.is_active !== false) || wallets[0] || { name: 'Dompet Utama', balance: 0 };

  // Largest and recent transactions
  const sortedExpenses = [...expenseTransactions].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const largestExpense = sortedExpenses[0] || null;

  return {
    user,
    totalIncome,
    totalExpenses,
    netCashflow,
    savingsRate,
    categoryList,
    topCategory: categoryList[0] || null,
    budgetStatusList,
    overBudgetCategories,
    warningBudgetCategories,
    totalLiquidBalance,
    defaultWallet,
    largestExpense,
    recentExpenses: expenseTransactions.slice(0, 4)
  };
}

/**
 * Generate comprehensive Expense Analysis in Indonesian
 */
function generateAnalysisReply(financials) {
  const { user, totalIncome, totalExpenses, netCashflow, savingsRate, categoryList, warningBudgetCategories, overBudgetCategories, largestExpense } = financials;
  const userName = user.full_name || 'Kak';

  let reply = `📊 <strong>Analisis Pengeluaran & Cashflow</strong> untuk <strong>${userName}</strong>\n\n`;
  reply += `Berikut adalah ringkasan performa finansial berdasarkan riwayat transaksi aktual Anda:\n\n`;

  reply += `💵 <strong>Ringkasan Cashflow:</strong>\n`;
  reply += `• Total Pemasukan: <strong>${formatRupiah(totalIncome)}</strong>\n`;
  reply += `• Total Pengeluaran: <strong>${formatRupiah(totalExpenses)}</strong>\n`;
  reply += `• Net Cashflow: <strong class="${netCashflow >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${netCashflow >= 0 ? '+' : ''}${formatRupiah(netCashflow)}</strong> (Surplus)\n`;
  reply += `• Rasio Tabungan (Savings Rate): <strong>${savingsRate}%</strong> ${savingsRate >= 20 ? '🌟 (Kondisi Sangat Sehat)' : '⚠️ (Perlu Ditingkatkan)'}\n\n`;

  if (categoryList.length > 0) {
    reply += `📌 <strong>Distribusi Kategori Pengeluaran:</strong>\n`;
    categoryList.slice(0, 4).forEach((c, i) => {
      reply += `${i + 1}. ${c.emoji} <strong>${c.name}</strong>: ${formatRupiah(c.total)} (<em>${c.percentage}%</em> dari total)\n`;
    });
    reply += `\n`;
  }

  // Budget warnings
  if (overBudgetCategories.length > 0 || warningBudgetCategories.length > 0) {
    reply += `⚠️ <strong>Peringatan Batas Anggaran (Budget):</strong>\n`;
    overBudgetCategories.forEach(b => {
      reply += `🚨 <strong>${b.category_emoji} ${b.category_name}</strong> telah MELEBIHI LIMIT! Terpakai ${formatRupiah(b.current_spent)} dari ${formatRupiah(b.monthly_limit)} (<strong>${b.percentage}%</strong>).\n`;
    });
    warningBudgetCategories.forEach(b => {
      reply += `🟡 <strong>${b.category_emoji} ${b.category_name}</strong> mendekati batas (<strong>${b.percentage}%</strong> terpakai, sisa ${formatRupiah(b.remaining)}).\n`;
    });
    reply += `\n`;
  }

  if (largestExpense) {
    reply += `💡 <strong>Catatan Penting:</strong> Pengeluaran tunggal terbesar Anda tercatat pada <em>"${largestExpense.note}"</em> sebesar <strong>${formatRupiah(largestExpense.amount)}</strong>.\n`;
  }

  reply += `\nSilakan pilih salah satu opsi cepat di bawah atau tanyakan rekomendasi penghematan spesifik!`;

  return reply;
}

/**
 * Generate Contextual Smart Savings Recommendations
 */
function generateSavingsAdviceReply(financials) {
  const { user, totalIncome, totalExpenses, categoryList, warningBudgetCategories, overBudgetCategories, largestExpense } = financials;
  const userName = user.full_name || 'Kak';

  let reply = `💡 <strong>Rekomendasi Penghematan Cerdas Tata AI</strong>\n\n`;
  reply += `Halo <strong>${userName}</strong>, berdasarkan analisis pola pengeluaran aktual Anda, berikut strategi penghematan yang dipersonalisasi:\n\n`;

  // 1. Identify high-risk or discretionary categories
  const lifestyleCat = categoryList.find(c => c.name.toLowerCase().includes('hiburan') || c.name.toLowerCase().includes('lifestyle'));
  const foodCat = categoryList.find(c => c.name.toLowerCase().includes('makan'));

  let recIndex = 1;

  if (lifestyleCat && lifestyleCat.total > 0) {
    const potentialSaving = Math.round(lifestyleCat.total * 0.25);
    reply += `<strong>${recIndex++}. Pangkas Pos Diskresioner (${lifestyleCat.emoji} ${lifestyleCat.name}):</strong>\n`;
    reply += `Anda telah membelanjakan <strong>${formatRupiah(lifestyleCat.total)}</strong> untuk pos ini. `;
    if (warningBudgetCategories.some(b => b.category_name.toLowerCase().includes('hiburan'))) {
      const hiburanBud = warningBudgetCategories.find(b => b.category_name.toLowerCase().includes('hiburan'));
      reply += `Budget kategori ini sudah menyentuh <strong>${hiburanBud.percentage}%</strong> dari plafon bulanan! `;
    }
    reply += `Dengan memangkas 25% aktivitas hiburan/rekreasi non-esensial, Anda bisa menghemat <strong>${formatRupiah(potentialSaving)}/bulan</strong>.\n\n`;
  }

  if (foodCat && foodCat.total > 0) {
    const diningSaving = Math.round(foodCat.total * 0.15);
    reply += `<strong>${recIndex++}. Optimasi Pengeluaran Makanan Harian (${foodCat.emoji} ${foodCat.name}):</strong>\n`;
    reply += `Total pengeluaran makanan tercatat <strong>${formatRupiah(foodCat.total)}</strong>. Terapkan strategi <em>meal prep</em> atau batasi pemesanan ojek online/kafe 2 kali seminggu untuk potensi hemat <strong>${formatRupiah(diningSaving)}/bulan</strong>.\n\n`;
  }

  reply += `<strong>${recIndex++}. Penerapan Formula Finansial 50/30/20:</strong>\n`;
  const idealNeeds = Math.round(totalIncome * 0.50);
  const idealWants = Math.round(totalIncome * 0.30);
  const idealSavings = Math.round(totalIncome * 0.20);
  reply += `• Kebutuhan Pokok (50%): Ideal maksimal <strong>${formatRupiah(idealNeeds)}</strong>\n`;
  reply += `• Keinginan & Gaya Hidup (30%): Ideal maksimal <strong>${formatRupiah(idealWants)}</strong>\n`;
  reply += `• Tabungan & Investasi (20%): Target minimal <strong>${formatRupiah(idealSavings)}</strong>\n\n`;

  reply += `<strong>${recIndex++}. Evaluasi Transaksi Mikro (Latte Factor):</strong>\n`;
  reply += `Pengeluaran kecil seperti kopi kekinian Rp25rb - Rp35rb per hari terakumulasi menjadi Rp750rb - Rp1jt per bulan. Alihkan 50% dari pengeluaran ini langsung ke saldo tabungan atau dompet investasi.\n\n`;

  reply += `🎯 <strong>Aksi Cepat:</strong> Coba tanyakan <em>"Simulasi kopi 35rb tiap hari"</em> untuk melihat kalkulasi dampak proyeksinya!`;

  return reply;
}

/**
 * Generate Smart Transaction Simulation
 */
function generateSimulationReply(message, financials) {
  const { totalIncome, defaultWallet, budgetStatusList } = financials;
  const parsedNominal = parseIndonesianNominal(message);

  const cleanMsg = (message || '').toLowerCase();

  // Detect item name
  let item = 'Pengeluaran Rutin';
  if (cleanMsg.includes('kopi')) item = 'Kopi Harian';
  else if (cleanMsg.includes('rokok')) item = 'Rokok Harian';
  else if (cleanMsg.includes('gym')) item = 'Keanggotaan Gym';
  else if (cleanMsg.includes('nongkrong')) item = 'Nongkrong Kafe';
  else if (cleanMsg.includes('makan')) item = 'Makan Siang';
  else if (cleanMsg.includes('laptop') || cleanMsg.includes('hp') || cleanMsg.includes('gadget')) item = 'Gadget / Elektronik';
  else if (cleanMsg.includes('liburan') || cleanMsg.includes('tiket')) item = 'Tiket Liburan';
  else if (cleanMsg.includes('bensin') || cleanMsg.includes('bbm')) item = 'BBM Kendaraan';

  // Determine frequency
  let frequency = 'harian';
  let isDaily = true;
  if (cleanMsg.includes('tiap hari') || cleanMsg.includes('per hari') || cleanMsg.includes('harian') || cleanMsg.includes('sehari') || cleanMsg.includes('setiap hari')) {
    frequency = 'harian';
    isDaily = true;
  } else if (cleanMsg.includes('tiap minggu') || cleanMsg.includes('per minggu') || cleanMsg.includes('mingguan')) {
    frequency = 'mingguan';
    isDaily = false;
  } else if (cleanMsg.includes('tiap bulan') || cleanMsg.includes('per bulan') || cleanMsg.includes('bulanan') || cleanMsg.includes('sebulan')) {
    frequency = 'bulanan';
    isDaily = false;
  } else if (parsedNominal && parsedNominal >= 1000000) {
    frequency = 'sekali beli (one-off)';
    isDaily = false;
  }

  // Nominal fallback if not specified
  let nominal = parsedNominal;
  if (!nominal) {
    if (item === 'Kopi Harian') nominal = 35000;
    else if (item === 'Gadget / Elektronik') nominal = 5000000;
    else nominal = 50000;
  }

  // Projections
  let dailyCost = 0;
  let monthlyImpact = 0;
  let annualImpact = 0;

  if (frequency === 'harian') {
    dailyCost = nominal;
    monthlyImpact = nominal * 30;
    annualImpact = nominal * 365;
  } else if (frequency === 'mingguan') {
    dailyCost = Math.round(nominal / 7);
    monthlyImpact = Math.round(nominal * 4.33);
    annualImpact = nominal * 52;
  } else if (frequency === 'bulanan') {
    dailyCost = Math.round(nominal / 30);
    monthlyImpact = nominal;
    annualImpact = nominal * 12;
  } else {
    // One-off purchase
    dailyCost = Math.round(nominal / 30);
    monthlyImpact = nominal;
    annualImpact = nominal;
  }

  const walletBalance = defaultWallet.balance || 0;
  const balanceAfter = walletBalance - monthlyImpact;
  const incomePct = totalIncome > 0 ? Math.round((monthlyImpact / totalIncome) * 100) : 0;

  // Feasibility
  let isFeasible = balanceAfter >= 0 && incomePct <= 30;
  let verdictText = isFeasible
    ? '✅ <strong>Dapat Ditoleransi:</strong> Beban ini masih dalam rentang batas aman kapasitas dompet Anda.'
    : '⚠️ <strong>Peringatan Risiko:</strong> Beban ini berpotensi menekan saldo dompet atau memakan porsi cashflow yang terlalu tinggi.';

  let reply = `🔮 <strong>Simulasi Pencatatan Transaksi Cerdas</strong>\n\n`;
  reply += `Rincian simulasi pengeluaran untuk <strong>${item}</strong> (${formatRupiah(nominal)} / ${frequency}):\n\n`;

  reply += `📈 <strong>Proyeksi Akumulasi Biaya:</strong>\n`;
  if (frequency === 'harian') {
    reply += `• Beban Harian: <strong>${formatRupiah(dailyCost)}</strong>\n`;
  }
  reply += `• Akumulasi 1 Bulan (30 hari): <strong>${formatRupiah(monthlyImpact)}</strong>\n`;
  reply += `• Akumulasi 1 Tahun (365 hari): <strong>${formatRupiah(annualImpact)}</strong>\n\n`;

  reply += `👛 <strong>Dampak ke Finansial Aktual:</strong>\n`;
  reply += `• Dompet Sumber: <strong>${defaultWallet.name}</strong> (Saldo saat ini: ${formatRupiah(walletBalance)})\n`;
  reply += `• Estimasi Sisa Saldo: <strong>${formatRupiah(balanceAfter)}</strong>\n`;
  reply += `• Porsi Cashflow Bulanan: <strong>${incomePct}%</strong> dari total pemasukan Anda\n\n`;

  reply += `💡 <strong>Rekomendasi Tata AI:</strong>\n${verdictText}\n`;
  if (frequency === 'harian' && annualImpact >= 5000000) {
    reply += `Jika Anda mengalihkan 50% dari pengeluaran ini ke instrumen reksadana/deposito dengan imbal hasil 6% p.a., Anda akan memiliki akumulasi dana sekitar <strong>${formatRupiah(Math.round(annualImpact * 0.53))}</strong> dalam 1 tahun!`;
  }

  const simulation = {
    item,
    nominal,
    frequency,
    daily_cost: dailyCost,
    monthly_impact: monthlyImpact,
    annual_impact: annualImpact,
    wallet_impact: {
      wallet_name: defaultWallet.name,
      current_balance: walletBalance,
      estimated_balance_after: balanceAfter
    },
    income_percentage: incomePct,
    is_feasible: isFeasible
  };

  return { reply, simulation };
}

/**
 * Generate Budget Status & Quota Inspection
 */
function generateBudgetReply(financials) {
  const { user, budgetStatusList, overBudgetCategories, warningBudgetCategories } = financials;
  const userName = user.full_name || 'Kak';

  let reply = `🎯 <strong>Evaluasi Status Budget & Plafon Pengeluaran</strong>\n\n`;
  reply += `Halo <strong>${userName}</strong>, berikut adalah status utilisasi anggaran aktif bulan ini:\n\n`;

  budgetStatusList.forEach(b => {
    let indicator = '🟢';
    if (b.isOver) indicator = '🚨';
    else if (b.isWarning) indicator = '🟡';

    reply += `${indicator} <strong>${b.category_emoji} ${b.category_name}</strong>\n`;
    reply += `   Terpakai: <strong>${formatRupiah(b.current_spent)}</strong> / ${formatRupiah(b.monthly_limit)} (<strong>${b.percentage}%</strong>)\n`;
    reply += `   Sisa Kuota: <strong>${formatRupiah(b.remaining)}</strong>\n\n`;
  });

  if (warningBudgetCategories.length > 0 || overBudgetCategories.length > 0) {
    reply += `💡 <strong>Saran Tata AI:</strong> Prioritaskan penghentian sementara transaksi non-pokok pada kategori bertanda 🟡 atau 🚨 untuk menjaga stabilitas sisa bulan ini.`;
  } else {
    reply += `✨ <strong>Bagus sekali!</strong> Seluruh pos anggaran Anda masih dalam batas aman terkendali. Pertahankan kedisiplinan ini hingga akhir periode.`;
  }

  return reply;
}

/**
 * Default Greeting and Guide
 */
function generateGreetingReply(financials) {
  const { user, totalLiquidBalance, totalExpenses, savingsRate, defaultWallet } = financials;
  const userName = user.full_name || 'Kak';

  let reply = `👋 <strong>Halo ${userName}! Saya Tata AI</strong>, asisten finansial cerdas pribadi Anda di TataDana.\n\n`;
  reply += `Saya terhubung langsung dengan riwayat transaksi dan anggaran dompet Anda secara real-time.\n\n`;
  reply += `📊 <strong>Snapshot Finansial Anda:</strong>\n`;
  reply += `• Total Saldo Likuid: <strong>${formatRupiah(totalLiquidBalance)}</strong>\n`;
  reply += `• Dompet Utama: <strong>${defaultWallet.name}</strong> (${formatRupiah(defaultWallet.balance)})\n`;
  reply += `• Pengeluaran Berjalan: <strong>${formatRupiah(totalExpenses)}</strong>\n`;
  reply += `• Tingkat Tabungan: <strong>${savingsRate}%</strong>\n\n`;
  reply += `Ada yang bisa saya bantu diskusikan hari ini? Anda dapat memilih rekomendasi prompt cepat di bawah atau mengetik pertanyaan finansial apa saja! 😊`;

  return reply;
}

/**
 * Main Tata AI Chat Processor
 * Evaluates context, user intent, performs real calculations, and returns structured response.
 */
function handleTataAiChat(message, history = [], dbState = {}, options = {}) {
  const cleanMsg = (message || '').trim().toLowerCase();
  const financials = analyzeFinancials(dbState);
  const userId = (dbState.user && dbState.user.id) || 'usr_admin_restu';

  // Ensure pending transactions map exists on dbState
  dbState.pendingAiTransactions = dbState.pendingAiTransactions || {};
  let pending = dbState.pendingAiTransactions[userId] || (options && options.pending_transaction);

  const activeWallets = (dbState.wallets || []).filter(w => w.is_active !== false);

  // ------------------------------------------------------------------
  // STEP A: If there is an active pending transaction waiting for wallet
  // ------------------------------------------------------------------
  if (pending && pending.amount > 0) {
    // 1. Check if user requests cancellation
    if (
      cleanMsg === 'batal' ||
      cleanMsg === 'cancel' ||
      cleanMsg === 'tidak jadi' ||
      cleanMsg === 'gak jadi' ||
      cleanMsg.includes('batal catat')
    ) {
      delete dbState.pendingAiTransactions[userId];
      return {
        ok: true,
        reply: `❌ Pencatatan pengeluaran <strong>${escapeHtml(pending.note)}</strong> (${formatRupiah(pending.amount)}) telah dibatalkan. Tidak ada transaksi yang disimpan ke database.<br><br>Ada hal lain yang ingin Anda tanyakan atau catat? 😊`,
        suggestions: [
          '📊 Analisis Pengeluaran',
          '💡 Rekomendasi Hemat',
          '🔮 Simulasi Kopi 35rb/hari',
          '🎯 Cek Peringatan Budget'
        ],
        pending_transaction: null
      };
    }

    // 2. Try matching user reply to user's wallets
    const matchedWallet = findWalletByUserInput(cleanMsg, activeWallets);
    if (matchedWallet) {
      // User replied with the wallet name! Save to database NOW.
      const newTx = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        user_id: userId,
        wallet_id: matchedWallet.id,
        wallet_name: matchedWallet.name,
        category_id: pending.category_id || 'cat_lain',
        category_name: pending.category_name || 'Lain-lain',
        category_emoji: pending.category_emoji || '💸',
        type: 'expense',
        amount: pending.amount,
        note: pending.note || 'Pengeluaran via Tata AI',
        source: 'tata_ai',
        transaction_date: new Date().toISOString()
      };

      dbState.transactions = dbState.transactions || [];
      dbState.transactions.unshift(newTx);

      // Deduct balance from the chosen wallet
      matchedWallet.balance = (Number(matchedWallet.balance) || 0) - pending.amount;

      // Update budget current_spent
      const targetBud = (dbState.budgets || []).find(b =>
        (b.category_id && b.category_id === newTx.category_id) ||
        (b.category_name && b.category_name.toLowerCase().includes(newTx.category_name.toLowerCase().slice(0, 4)))
      );
      if (targetBud) {
        targetBud.current_spent = (Number(targetBud.current_spent) || 0) + pending.amount;
      }

      if (dbState.subscription) {
        dbState.subscription.monthly_transaction_count = (dbState.subscription.monthly_transaction_count || 0) + 1;
      }

      // Clear pending transaction
      delete dbState.pendingAiTransactions[userId];

      const reply = `✅ <strong>Pengeluaran berhasil dicatat ke database!</strong>\n\n` +
        `• Nominal : <strong>${formatRupiah(newTx.amount)}</strong>\n` +
        `• Kategori : ${newTx.category_emoji} <strong>${newTx.category_name}</strong>\n` +
        `• Dompet : 👛 <strong>${matchedWallet.name}</strong> (Sisa saldo: <strong>${formatRupiah(matchedWallet.balance)}</strong>)\n` +
        `• Catatan : <em>${escapeHtml(newTx.note)}</em>\n\n` +
        `Transaksi telah tersimpan secara permanen ke tabel Transaksi dan langsung terintegrasi dengan saldo serta budget Anda! 🎉`;

      return {
        ok: true,
        reply,
        suggestions: [
          '📊 Analisis Pengeluaran',
          '🎯 Cek Status Budget',
          '👛 Saldo Semua Dompet',
          '💡 Rekomendasi Hemat'
        ],
        transaction: newTx,
        pending_transaction: null
      };
    }

    // 3. If user typed a brand-new expense instead of picking wallet, update pending
    const newNominal = parseIndonesianNominal(cleanMsg);
    const isNewExpense = newNominal && newNominal > 0 &&
      !cleanMsg.includes('simulasi') && !cleanMsg.includes('kalau beli') && !cleanMsg.includes('proyeksi') && !cleanMsg.includes('tiap hari');

    if (!isNewExpense) {
      // Unrecognized wallet -> ask again politely with dynamic wallet list
      const walletOptionsText = formatWalletOptionsText(activeWallets);
      return {
        ok: true,
        reply: `⚠️ Dompet <em>"${escapeHtml(message)}"</em> tidak ditemukan di daftar dompet Anda.<br><br>Transaksi ini pakai dompet yang mana? <strong>${walletOptionsText}</strong>?`,
        suggestions: activeWallets.map(w => `👛 ${w.institution_name || (w.type === 'cash' ? 'Cash' : w.name)}`).concat(['❌ Batal Catat']),
        pending_transaction: pending
      };
    }
  }

  // ------------------------------------------------------------------
  // STEP B: Check if user is typing an Expense Transaction (e.g. 'makan 20rb')
  // ------------------------------------------------------------------
  const parsedNominal = parseIndonesianNominal(cleanMsg);
  const isSimulation = (
    cleanMsg.includes('simulasi') ||
    cleanMsg.includes('kalau beli') ||
    cleanMsg.includes('seandainya') ||
    cleanMsg.includes('tiap hari') ||
    cleanMsg.includes('per hari') ||
    cleanMsg.includes('proyeksi') ||
    (cleanMsg.includes('kalau') && parsedNominal !== null)
  );

  const isAnalysisQuery = (
    cleanMsg.includes('analisis') ||
    cleanMsg.includes('analisa') ||
    cleanMsg.includes('rekap') ||
    cleanMsg.includes('boros') ||
    cleanMsg.includes('laporan') ||
    cleanMsg.includes('keuangan saya')
  );

  const isSavingsQuery = (
    cleanMsg.includes('hemat') ||
    cleanMsg.includes('rekomendasi') ||
    cleanMsg.includes('saran') ||
    cleanMsg.includes('tips') ||
    cleanMsg.includes('cara hemat') ||
    cleanMsg.includes('menabung')
  );

  const isBudgetQuery = (
    cleanMsg.includes('budget') ||
    cleanMsg.includes('anggaran') ||
    cleanMsg.includes('limit') ||
    cleanMsg.includes('kuota') ||
    cleanMsg.includes('overbudget')
  );

  const isExplicitIncome = (
    (cleanMsg.includes('gaji') || cleanMsg.includes('gajian') || cleanMsg.includes('bonus') || cleanMsg.includes('penjualan')) &&
    !/^(?:bayar|beli|order|isi|belanja|jajan|makan|ngopi)\b/i.test(cleanMsg) &&
    !/(?:gaji|upah|honor)\s+(?:supir|sopir|pembantu|art|karyawan|staf|pegawai)/i.test(cleanMsg)
  );

  // If user inputs an expense with nominal:
  if (parsedNominal && parsedNominal > 0 && !isSimulation && !isAnalysisQuery && !isSavingsQuery && !isBudgetQuery && !isExplicitIncome) {
    const details = extractExpenseDetails(message, dbState);
    const walletOptionsText = formatWalletOptionsText(activeWallets);

    // Save as pending transaction - DO NOT SAVE TO TRANSAKSI YET!
    const pendingData = {
      type: 'expense',
      amount: details.nominal,
      category_id: details.categoryId,
      category_name: details.categoryName,
      category_emoji: details.categoryEmoji,
      note: details.note,
      created_at: Date.now()
    };
    dbState.pendingAiTransactions[userId] = pendingData;

    const reply = `📝 <strong>Pengeluaran Terdeteksi:</strong>\n` +
      `• Nominal: <strong>${formatRupiah(details.nominal)}</strong>\n` +
      `• Kategori: ${details.categoryEmoji} <strong>${details.categoryName}</strong>\n` +
      `• Catatan: <em>${escapeHtml(details.note)}</em>\n\n` +
      `Transaksi ini pakai dompet yang mana? <strong>${walletOptionsText}</strong>?`;

    const suggestions = activeWallets.map(w => `👛 ${w.institution_name || (w.type === 'cash' ? 'Cash' : w.name)}`).concat(['❌ Batal Catat']);

    return {
      ok: true,
      reply,
      suggestions,
      pending_transaction: pendingData
    };
  }

  // ------------------------------------------------------------------
  // STEP C: Other Conversational Intents (Simulation, Savings, Analysis, Budget, Greeting)
  // ------------------------------------------------------------------
  let reply = '';
  let simulation = null;
  let suggestions = [
    '📊 Analisis Pengeluaran',
    '💡 Rekomendasi Hemat',
    '🔮 Simulasi Kopi 35rb/hari',
    '🎯 Cek Peringatan Budget'
  ];

  // 1. Simulation intent
  if (isSimulation) {
    const simResult = generateSimulationReply(message, financials);
    reply = simResult.reply;
    simulation = simResult.simulation;
    suggestions = [
      '💡 Rekomendasi Hemat Lanjutan',
      '📊 Cek Dampak ke Budget',
      '🔮 Simulasi Gadget 5jt',
      '📈 Analisis Cashflow Lengkap'
    ];
  }
  // 2. Savings Advice intent
  else if (isSavingsQuery) {
    reply = generateSavingsAdviceReply(financials);
    suggestions = [
      '🔮 Simulasi Pangkas Hiburan 20%',
      '🎯 Evaluasi Status Budget',
      '📊 Pos Pengeluaran Terboros',
      '💰 Formula Alokasi 50/30/20'
    ];
  }
  // 3. Analysis / Rekap intent
  else if (isAnalysisQuery) {
    reply = generateAnalysisReply(financials);
    suggestions = [
      '💡 Beri Rekomendasi Hemat',
      '🎯 Cek Kategori Overbudget',
      '🔮 Simulasi Pengeluaran Harian',
      '👛 Status Saldo Semua Dompet'
    ];
  }
  // 4. Budget Check intent
  else if (isBudgetQuery) {
    reply = generateBudgetReply(financials);
    suggestions = [
      '💡 Saran Penghematan Budget',
      '📊 Analisis Pengeluaran Lengkap',
      '🔮 Simulasi Tambah Belanja 100rb',
      '💳 Detail Transaksi Terbaru'
    ];
  }
  // 5. Greeting / Info / Default
  else {
    reply = generateGreetingReply(financials);
    suggestions = [
      '📊 Analisis Pengeluaran Saya',
      '💡 Rekomendasi Hemat Cerdas',
      '🔮 Simulasi Kopi 35rb/hari',
      '🎯 Cek Kuota & Limit Budget'
    ];
  }

  return {
    ok: true,
    reply,
    suggestions,
    simulation
  };
}

module.exports = {
  formatRupiah,
  parseIndonesianNominal,
  analyzeFinancials,
  generateAnalysisReply,
  generateSavingsAdviceReply,
  generateSimulationReply,
  generateBudgetReply,
  generateGreetingReply,
  handleTataAiChat,
  extractExpenseDetails,
  formatWalletOptionsText,
  findWalletByUserInput
};
