import { AppState, getInitialState, saveState } from './store';
import { 
  Transaction, 
  Wallet, 
  Budget, 
  Category, 
  PlanTier 
} from './types';
import { 
  formatRupiah, 
  formatWIBDate, 
  parseIndonesianCurrency, 
  isSalaryExpense,
  generateProgressBar, 
  PLAN_LIMITS 
} from './utils';

export interface TelegramProcessResult {
  replyText: string;
  transaction?: Transaction;
  isSuccess: boolean;
  advisorMessage?: string;
}

export function processTelegramMessage(
  inputText: string,
  state: AppState,
  options?: {
    isVoiceNote?: boolean;
    voiceDurationSec?: number;
    voiceTranscript?: string;
    isPhotoReceipt?: boolean;
    photoUrl?: string;
  }
): { result: TelegramProcessResult; newState: AppState } {
  const text = (inputText || '').trim();
  const lower = text.toLowerCase();
  let currentState = { ...state };
  const userPlan: PlanTier = currentState.subscription.plan;

  // 1. Check Voice Note duration limit (maks 60 detik)
  if (options?.isVoiceNote && (options?.voiceDurationSec || 0) > 60) {
    return {
      result: {
        replyText: `⚠️ Rekaman suara terlalu panjang (${options.voiceDurationSec}s).\nUntuk akurasi dan efisiensi, durasi voice note maksimal 60 detik ya. Silakan kirim rekaman yang lebih singkat! 🎙️`,
        isSuccess: false,
      },
      newState: currentState,
    };
  }

  // 2. Check Photo Receipt plan restrictions (Part 4.2: Pro only)
  if (options?.isPhotoReceipt && userPlan !== 'pro') {
    return {
      result: {
        replyText: `🔒 <strong>Fitur Eksklusif Paket Pro!</strong>\n\nInput transaksi via foto struk belanja dengan AI OCR hanya tersedia untuk pengguna paket Pro.\n\n✨ Upgrade ke <strong>TataDana Pro (Rp99.000 Sekali Bayar)</strong> untuk menikmati:\n• Scan foto struk multi-item tanpa batas\n• AI Financial Advisor proaktif\n• Export PDF & Excel tanpa batas\n\nKetik /upgrade atau kunjungi dashboard untuk upgrade!`,
        isSuccess: false,
      },
      newState: currentState,
    };
  }

  // 3. Check Commands
  if (text.startsWith('/')) {
    const cmdReply = handleBotCommands(text, currentState);
    return {
      result: {
        replyText: cmdReply,
        isSuccess: true,
      },
      newState: currentState,
    };
  }

  // 4. Plan Transaction Limit Enforcement (Part 4.9: Starter max 50 tx/month)
  const currentMonthPeriod = new Date().toISOString().slice(0, 7);
  if (
    userPlan === 'starter' &&
    currentState.subscription.monthly_transaction_count >= PLAN_LIMITS.starter.maxMonthlyTransactions
  ) {
    return {
      result: {
        replyText: `🚫 <strong>Batas Transaksi Bulanan Tercapai!</strong>\n\nKamu sudah mencapai limit ${PLAN_LIMITS.starter.maxMonthlyTransactions} transaksi bulan ini di paket Starter.\n\nYuk beralih ke <strong>TataDana Pro (Rp99.000 Sekali Bayar)</strong> untuk pencatatan UNLIMITED selamanya tanpa batas bulanan! 🚀`,
        isSuccess: false,
      },
      newState: currentState,
    };
  }

  // 5. Default Wallet lookup
  let defaultWallet = currentState.wallets.find(w => w.is_default && w.is_active) || currentState.wallets[0];
  if (!defaultWallet) {
    return {
      result: {
        replyText: `⚠️ Kamu belum memiliki dompet aktif di TataDana. Silakan buat dompet di dashboard terlebih dahulu!`,
        isSuccess: false,
      },
      newState: currentState,
    };
  }

  // 6. Parsing logic
  let nominal: number | null = null;
  let type: 'income' | 'expense' = 'expense';
  let matchedCategory: Category | undefined = undefined;
  let note = text;
  let receiptItems = undefined;
  let merchantName = undefined;

  // Handle Receipt Photo OCR (Simulated AI Vision Extraction)
  if (options?.isPhotoReceipt) {
    merchantName = 'Indomaret Point Super';
    note = 'Belanja kebutuhan dapur (3 item)';
    type = 'expense';
    nominal = 94500;
    receiptItems = [
      { id: 'it_' + Date.now() + '_1', transaction_id: '', item_name: 'Beras Pandan Wangi 2.5kg', quantity: 1, price: 42000, category_name: 'Belanja & Groceries' },
      { id: 'it_' + Date.now() + '_2', transaction_id: '', item_name: 'Kecap Manis Bango 520ml', quantity: 1, price: 23500, category_name: 'Belanja & Groceries' },
      { id: 'it_' + Date.now() + '_3', transaction_id: '', item_name: 'Telur Ayam Omega 10 btr', quantity: 1, price: 29000, category_name: 'Belanja & Groceries' },
    ];
    matchedCategory = currentState.categories.find(c => c.name.toLowerCase().includes('belanja')) || currentState.categories[0];
  } else {
    // Text or Voice Note transcription parsing
    nominal = parseIndonesianCurrency(text);

    // 1. Check for salary expense (Income Inversion Prevention: gaji supir, bayar gaji pembantu, etc. -> expense)
    if (isSalaryExpense(lower)) {
      type = 'expense';
      matchedCategory = currentState.categories.find(c => c.name.toLowerCase().includes('tagihan'))
        || currentState.categories.find(c => c.name.toLowerCase().includes('lain'))
        || currentState.categories[0];
    } else if (
      (lower.includes('gaji') || 
       lower.includes('gajian') || 
       lower.includes('pemasukan') || 
       lower.includes('transfer masuk') || 
       lower.includes('freelance') ||
       lower.includes('dapat bonus') ||
       lower.includes('bonus') ||
       lower.includes('cair')) &&
      !/^(?:bayar|beli|order|isi|belanja|jajan|makan|ngopi)\b/i.test(lower)
    ) {
      type = 'income';
      matchedCategory = currentState.categories.find(c => c.type === 'income') || currentState.categories[0];
    } else {
      type = 'expense';
      // Match category by keyword
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
        matchedCategory = currentState.categories.find(c => c.name.toLowerCase().includes('makan'));
      } else if (
        lower.includes('bensin') || lower.includes('pertamax') || lower.includes('pertalite') ||
        lower.includes('solar') || lower.includes('bbm') || lower.includes('gojek') ||
        lower.includes('grab') || lower.includes('tol') || lower.includes('parkir') ||
        lower.includes('motor') || lower.includes('mobil') || lower.includes('kereta') ||
        lower.includes('krl') || lower.includes('mrt') || lower.includes('ojol') ||
        lower.includes('taksi') || lower.includes('taxi') || lower.includes('angkot')
      ) {
        matchedCategory = currentState.categories.find(c => c.name.toLowerCase().includes('transport'));
      } else if (
        lower.includes('nonton') || lower.includes('bioskop') || lower.includes('game') ||
        lower.includes('topup') || lower.includes('steam') || lower.includes('karaoke') ||
        lower.includes('xxi') || lower.includes('cgv') || lower.includes('netflix') ||
        lower.includes('spotify') || lower.includes('youtube') || lower.includes('liburan')
      ) {
        matchedCategory = currentState.categories.find(c => c.name.toLowerCase().includes('hiburan'));
      } else if (
        lower.includes('listrik') || lower.includes('air') || lower.includes('wifi') ||
        lower.includes('indihome') || lower.includes('pulsa') || lower.includes('pln') ||
        lower.includes('paket data') || lower.includes('kuota') || lower.includes('pdam') ||
        lower.includes('tagihan') || lower.includes('iuran') || lower.includes('bpjs') ||
        lower.includes('kos') || lower.includes('sewa') || lower.includes('kontrakan') ||
        lower.includes('supir') || lower.includes('sopir') || lower.includes('pembantu') ||
        lower.includes('art')
      ) {
        matchedCategory = currentState.categories.find(c => c.name.toLowerCase().includes('tagihan'));
      } else if (
        lower.includes('obat') || lower.includes('apotek') || lower.includes('apotik') ||
        lower.includes('dokter') || lower.includes('vitamin') || lower.includes('klinik') ||
        lower.includes('rs') || lower.includes('rumah sakit') || lower.includes('kesehatan')
      ) {
        matchedCategory = currentState.categories.find(c => c.name.toLowerCase().includes('kesehatan'));
      } else if (
        lower.includes('baju') || lower.includes('sepatu') || lower.includes('indomaret') ||
        lower.includes('alfamart') || lower.includes('shopee') || lower.includes('tokped') ||
        lower.includes('tokopedia') || lower.includes('supermarket') || lower.includes('belanja') ||
        lower.includes('tas') || lower.includes('celana')
      ) {
        matchedCategory = currentState.categories.find(c => c.name.toLowerCase().includes('belanja'));
      } else if (
        lower.includes('buku') || lower.includes('kursus') || lower.includes('kuliah') ||
        lower.includes('sekolah') || lower.includes('ujian') || lower.includes('les') ||
        lower.includes('spp') || lower.includes('edukasi')
      ) {
        matchedCategory = currentState.categories.find(c => c.name.toLowerCase().includes('buku') || c.name.toLowerCase().includes('edukasi'));
      }

      // Fallback for unrecognized expense: Use 'Lain-lain' to prevent silent misclassification to Makanan & Minuman
      if (!matchedCategory) {
        matchedCategory = currentState.categories.find(c => c.name.toLowerCase().includes('lain'))
          || currentState.categories.find(c => c.id === 'cat_lain')
          || {
            id: 'cat_lain',
            user_id: currentState.user.id,
            name: 'Lain-lain',
            emoji: '💸',
            color: '#71717a',
            type: 'expense',
            is_default: true,
          };
      }
    }
  }

  // Error validation if parsing fails
  if (!nominal || nominal <= 0) {
    return {
      result: {
        replyText: `🤔 <strong>Maaf, TataDana belum memahami pesanmu.</strong>\n\nPastikan mencantumkan nominal dengan jelas ya!\n\n💡 <strong>Contoh format yang benar:</strong>\n• <em>"Beli bakso 15rb"</em>\n• <em>"Gajian 5jt"</em>\n• <em>"Isi bensin motor 50k"</em>\n• <em>"Kopi susu 25.000"</em>\n\nAtau ketik <code>/bantuan</code> untuk panduan lengkap.`,
        isSuccess: false,
      },
      newState: currentState,
    };
  }

  // 7. Update Balances & Budgets
  const newBalance = type === 'income' 
    ? defaultWallet.balance + nominal 
    : defaultWallet.balance - nominal;

  const updatedWallets = currentState.wallets.map(w => {
    if (w.id === defaultWallet.id) {
      return { ...w, balance: newBalance };
    }
    return w;
  });

  let currentBudgetSpent = 0;
  let budgetLimit = 0;
  let updatedBudgets = [...currentState.budgets];

  if (type === 'expense' && matchedCategory) {
    let budget = updatedBudgets.find(b => b.category_id === matchedCategory?.id);
    if (budget) {
      budget = {
        ...budget,
        current_spent: budget.current_spent + nominal,
      };
      currentBudgetSpent = budget.current_spent;
      budgetLimit = budget.monthly_limit;
      updatedBudgets = updatedBudgets.map(b => b.id === budget?.id ? budget : b);
    }
  }

  // 8. Create Transaction Object
  const newTx: Transaction = {
    id: 'tx_' + Date.now(),
    user_id: currentState.user.id,
    wallet_id: defaultWallet.id,
    wallet_name: defaultWallet.name,
    category_id: matchedCategory?.id,
    category_name: matchedCategory?.name || (type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
    category_emoji: matchedCategory?.emoji || (type === 'income' ? '💼' : '💸'),
    type: type,
    amount: nominal,
    note: note,
    source: options?.isPhotoReceipt 
      ? 'telegram_receipt' 
      : (options?.isVoiceNote ? 'telegram_voice' : 'telegram_text'),
    merchant_name: merchantName,
    items: receiptItems,
    receipt_image_url: options?.photoUrl,
    transaction_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const updatedTransactions = [newTx, ...currentState.transactions];
  const updatedSubscription = {
    ...currentState.subscription,
    monthly_transaction_count: currentState.subscription.monthly_transaction_count + 1,
  };

  currentState = {
    ...currentState,
    wallets: updatedWallets,
    budgets: updatedBudgets,
    transactions: updatedTransactions,
    subscription: updatedSubscription,
  };

  // 9. Format Reply
  const now = new Date();
  const dateFormatted = formatWIBDate(now, 'full');
  let replyText = '';

  if (type === 'income') {
    replyText = `📅 ${dateFormatted}\n` +
      `💰 <strong>Pemasukan tercatat!</strong>\n` +
      `├ Nominal : <strong>${formatRupiah(nominal)}</strong>\n` +
      `├ Kategori : 💼 Pemasukan\n` +
      `├ Dompet : 👛 ${defaultWallet.name}\n` +
      `└ Saldo baru : <strong>${formatRupiah(newBalance)}</strong>\n\n` +
      `💪 Semangat terus! Jangan lupa sisihkan untuk tabungan ya.`;
  } else {
    let budgetInfoText = '';
    if (budgetLimit > 0) {
      const pct = Math.round((currentBudgetSpent / budgetLimit) * 100);
      const progressBar = generateProgressBar(pct, 10);
      const remaining = Math.max(0, budgetLimit - currentBudgetSpent);

      let motivation = '👍 Pengeluaran terkendali!';
      if (pct >= 100) {
        motivation = '🚨 PERHATIAN: Budget kategori ini telah habis!';
      } else if (pct >= 80) {
        motivation = '⚠️ Waspada: Budget kategori ini sudah mencapai 80%! Kurangi jajan.';
      }

      budgetInfoText = `\n\n📊 <strong>Budget ${matchedCategory?.name} bulan ini:</strong>\n` +
        `[${progressBar}] ${pct}% — sisa ${formatRupiah(remaining)}\n` +
        `<em>${motivation}</em>`;
    }

    const transcriptPrefix = options?.isVoiceNote && options?.voiceTranscript
      ? `🎙️ <em>Transkrip: "${options.voiceTranscript}"</em>\n\n`
      : '';

    replyText = `${transcriptPrefix}📅 ${dateFormatted}\n` +
      `💸 <strong>Pengeluaran tercatat!</strong>\n` +
      `├ Nominal : <strong>${formatRupiah(nominal)}</strong>\n` +
      `├ Kategori : ${matchedCategory?.emoji} ${matchedCategory?.name}\n` +
      `├ Dompet : 👛 ${defaultWallet.name}\n` +
      `├ Catatan : ${note}\n` +
      `└ Saldo : <strong>${formatRupiah(newBalance)}</strong>` +
      budgetInfoText;
  }

  // 10. AI Financial Advisor check (Part 4.7: Pro only)
  let advisorMsg = undefined;
  if (userPlan === 'pro' && type === 'expense') {
    if (budgetLimit > 0 && (currentBudgetSpent / budgetLimit) >= 0.8) {
      advisorMsg = `🤖 <strong>Financial Advisor</strong>\nHei ${currentState.user.full_name}! Pengeluaran kategori ${matchedCategory?.name} kamu sudah mencapai batas waspada bulan ini.\n💡 <strong>Saran:</strong> Tahan pengeluaran non-primer di kategori ini selama 7 hari ke depan untuk menjaga cashflow bulanan tetap sehat.`;
    }
  }

  return {
    result: {
      replyText,
      transaction: newTx,
      isSuccess: true,
      advisorMessage: advisorMsg,
    },
    newState: currentState,
  };
}

function handleBotCommands(commandText: string, state: AppState): string {
  const cmd = commandText.trim().toLowerCase();

  if (cmd === '/saldo') {
    const total = state.wallets.reduce((acc, w) => acc + w.balance, 0);
    const lines = state.wallets.map(w => `• 👛 ${w.name}: <strong>${formatRupiah(w.balance)}</strong>${w.is_default ? ' <em>(Default)</em>' : ''}`).join('\n');
    return `💳 <strong>SALDO SEMUA DOMPET:</strong>\n\n${lines}\n\n───────────────\n💰 <strong>Total Kekayaan: ${formatRupiah(total)}</strong>`;
  }

  if (cmd === '/hari ini') {
    const todayStr = new Date().toISOString().slice(0, 10);
    const txsToday = state.transactions.filter(t => t.transaction_date.slice(0, 10) === todayStr);
    const totalExp = txsToday.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const totalInc = txsToday.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);

    const list = txsToday.length > 0 
      ? txsToday.map(t => `${t.type === 'income' ? '🟢' : '🔴'} ${formatRupiah(t.amount)} — ${t.note}`).join('\n')
      : '<em>Belum ada transaksi hari ini.</em>';

    return `📅 <strong>REKAP TRANSAKSI HARI INI:</strong>\n\n${list}\n\n───────────────\n💸 Pengeluaran: <strong>${formatRupiah(totalExp)}</strong>\n💰 Pemasukan: <strong>${formatRupiah(totalInc)}</strong>`;
  }

  if (cmd === '/minggu ini') {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recent = state.transactions.filter(t => new Date(t.transaction_date) >= sevenDaysAgo);
    const totalExp = recent.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const totalInc = recent.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);

    return `📊 <strong>REKAP 7 HARI TERAKHIR:</strong>\n\n• Total Transaksi : ${recent.length}\n• Total Pemasukan : <strong>${formatRupiah(totalInc)}</strong>\n• Total Pengeluaran : <strong>${formatRupiah(totalExp)}</strong>\n• Net Cashflow : <strong>${formatRupiah(totalInc - totalExp)}</strong>\n\nLihat grafik lengkapnya di dashboard web TataDana!`;
  }

  if (cmd === '/bulan ini') {
    const totalExp = state.transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const totalInc = state.transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);

    return `🗓️ <strong>REKAP BULAN INI (WIB):</strong>\n\n💰 Total Masuk : <strong>${formatRupiah(totalInc)}</strong>\n💸 Total Keluar : <strong>${formatRupiah(totalExp)}</strong>\n📈 Sisa Bersih : <strong>${formatRupiah(totalInc - totalExp)}</strong>\n\nKetik <code>/budget</code> untuk memantau batas pengeluaran kategori.`;
  }

  if (cmd === '/budget') {
    const lines = state.budgets.map(b => {
      const pct = Math.round((b.current_spent / b.monthly_limit) * 100);
      const bar = generateProgressBar(pct, 8);
      const sisa = Math.max(0, b.monthly_limit - b.current_spent);
      return `${b.category_emoji} <strong>${b.category_name}</strong>\n[${bar}] ${pct}%\nTerpakai: ${formatRupiah(b.current_spent)} / ${formatRupiah(b.monthly_limit)} (Sisa: ${formatRupiah(sisa)})\n`;
    }).join('\n');

    return `🎯 <strong>STATUS BUDGET BULAN INI:</strong>\n\n${lines}`;
  }

  if (cmd === '/sheet') {
    return `📑 <strong>Google Sheets Pribadi:</strong>\n\nData transaksi TataDana kamu otomatis disinkronisasi ke Google Sheets privat:\n👉 <a href="https://docs.google.com/spreadsheets/d/tatadana-demo-${state.user.id}">Buka Google Sheet Pribadi Saya</a>\n\nSetiap transaksi baru langsung terupdate secara real-time!`;
  }

  return `🤖 <strong>PERINTAH TANGGAP TATADANA:</strong>\n\n` +
    `• <code>/saldo</code> — Lihat saldo semua dompet\n` +
    `• <code>/hari ini</code> — Rekap transaksi hari ini\n` +
    `• <code>/minggu ini</code> — Rekap 7 hari terakhir\n` +
    `• <code>/bulan ini</code> — Ringkasan bulan berjalan\n` +
    `• <code>/budget</code> — Pantau limit budget kategori\n` +
    `• <code>/sheet</code> — Link Google Sheet privat\n` +
    `• <code>/bantuan</code> — Daftar semua perintah\n\n` +
    `Atau langsung ketik transaksi natural: <em>"beli makan 30rb"</em>, <em>"gajian 5jt"</em>, kirim voice note 🎙️, atau kirim foto struk 📸!`;
}
