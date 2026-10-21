// ====================================================================
// TataDana Fintech SaaS: Telegram NLP & Currency Parsing Engine
// Production-grade parser for Indonesian financial natural language
// Timezone: Asia/Jakarta (WIB)
// ====================================================================

const crypto = require('crypto');

/**
 * Robust Indonesian Currency Parser
 * Extracts nominal correctly from natural language without digit-concatenation errors.
 * 
 * Supports:
 * - Juta variants: "12,5jt", "12.5jt", "12,5 juta", "12.5 juta", "1.5jt", "2jt", "2 juta", "12jt"
 * - Ribu variants: "50rb", "50 rb", "50ribu", "50 ribu", "50k", "50 k", "12,5rb", "12.5rb", "2.5k"
 * - Indonesian thousands separators: "25.000", "25.500", "1.500.000", "12.500.000", "25,000", "25.000,-"
 * - Multi-word strings with quantities: "beli 2 ayam geprek 25.000" -> 25000 (NOT 225000)
 * - Explicit currency prefixes: "Rp 25.000", "Rp 500", "IDR 50000"
 * - Suffix currency markers: "25000 rupiah", "500 perak"
 * - Unformatted plain numbers: "25000", "beli 2 ayam 25000" -> 25000
 */
function parseIndonesianCurrency(text) {
  if (!text || typeof text !== 'string') return null;
  const str = text.trim();
  if (str.length === 0) return null;

  // 1. Juta / Million: e.g. "12,5jt", "12.5jt", "12,5 juta", "12.5 juta", "1.5jt", "2jt", "2 juta", "12jt"
  const jtMatches = [...str.matchAll(/(?:rp\.?\s*|idr\s*)?(\d+(?:[.,]\d+)?)\s*(?:jt|juta|million)\b/gi)];
  if (jtMatches.length > 0) {
    const match = jtMatches[jtMatches.length - 1];
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return Math.round(val * 1000000);
  }

  // 2. Ribu / Thousand / k: e.g. "50rb", "50 rb", "50ribu", "50 ribu", "50k", "50 k", "12,5rb", "12.5rb", "2.5k"
  const rbMatches = [...str.matchAll(/(?:rp\.?\s*|idr\s*)?(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/gi)];
  if (rbMatches.length > 0) {
    const match = rbMatches[rbMatches.length - 1];
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return Math.round(val * 1000);
  }

  // 3. Indonesian / standard thousands separator: e.g. "25.000", "25.500", "1.500.000", "12.500.000", "25,000", "25.000,-"
  // Ensures \b boundaries so single-digit quantities like "2 ayam" are NEVER matched or concatenated
  const sepMatches = [...str.matchAll(/(?:rp\.?\s*|idr\s*)?(\d{1,3}(?:[.,]\d{3})+(?:,-\b|\b))/gi)];
  if (sepMatches.length > 0) {
    const match = sepMatches[sepMatches.length - 1];
    const raw = match[1].replace(/[.,]/g, '').replace(',-', '');
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 4. Currency prefix with any plain number: e.g. "Rp 25000", "Rp. 500", "rp5000", "IDR 100000"
  const rpMatches = [...str.matchAll(/(?:rp\.?\s*|idr\s*)(\d+)/gi)];
  if (rpMatches.length > 0) {
    const match = rpMatches[rpMatches.length - 1];
    const val = parseInt(match[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 5. Suffix currency unit: e.g. "25000 rupiah", "500 perak"
  const suffixMatches = [...str.matchAll(/\b(\d+)\s*(?:rupiah|perak)\b/gi)];
  if (suffixMatches.length > 0) {
    const match = suffixMatches[suffixMatches.length - 1];
    const val = parseInt(match[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 6. Plain numbers of 4+ digits (>= 1000 IDR): e.g. "25000", "beli 2 ayam geprek 25000"
  // Safely takes the last 4+ digit number, ignoring 1-2 digit item quantities like "2 ayam"
  const plainNums = [...str.matchAll(/\b(\d{4,})\b/g)];
  if (plainNums.length > 0) {
    const match = plainNums[plainNums.length - 1];
    const val = parseInt(match[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 7. Pure numeric text fallback: e.g. "500", "25000"
  if (/^\s*\d+\s*$/.test(str)) {
    const val = parseInt(str.trim(), 10);
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

/**
 * Income Inversion Detector:
 * Returns true if text indicates paying someone's salary/wages (EXPENSE),
 * rather than the user receiving income.
 * 
 * Examples:
 * - "gaji supir 1.5jt" -> true (Expense)
 * - "bayar gaji pembantu 2jt" -> true (Expense)
 * - "bayar gaji supir" -> true (Expense)
 * - "gaji karyawan 3.5jt" -> true (Expense)
 * - "gaji 12,5jt" -> false (Income)
 * - "gajian kantor 9.5jt" -> false (Income)
 */
function isSalaryExpense(text) {
  if (!text) return false;
  const lower = text.toLowerCase();

  const payingVerbPatterns = /(?:bayar|membayar|bayarin|kasih|ngasih|biaya|pengeluaran|keluar|transfer)\s+(?:gaji|upah|honor)/i;
  const recipientPatterns = /(?:gaji|upah|honor)\s+(?:supir|sopir|pembantu|art|karyawan|staf|staff|pegawai|babysitter|baby\s+sitter|pengasuh|satpam|security|tukang|suster|asisten|pekerja|ob|intern|magang|montir|perawat|honorer)/i;
  const bayarPrefixWithGaji = /bayar\b.*?\b(?:gaji|upah|honor)\b/i;

  return payingVerbPatterns.test(lower) || recipientPatterns.test(lower) || bayarPrefixWithGaji.test(lower);
}

/**
 * Categorize Indonesian Financial Text
 * Prevents silent misclassification by explicitly matching categories,
 * and falling back to 'Lain-lain' instead of 'Makanan & Minuman'.
 */
function categorizeTelegramMessage(text) {
  const nominal = parseIndonesianCurrency(text);
  const lower = (text || '').toLowerCase();

  // 1. Income Inversion Check
  if (isSalaryExpense(lower)) {
    return {
      nominal,
      type: 'expense',
      categoryName: 'Tagihan & Utilitas',
      categoryEmoji: '🏠',
      note: text || 'Gaji / Upah Pegawai'
    };
  }

  // 2. Income Detection (when not a salary expense)
  const isExplicitIncome = (
    lower.includes('gaji') ||
    lower.includes('gajian') ||
    lower.includes('bonus') ||
    lower.includes('freelance') ||
    lower.includes('cair') ||
    lower.includes('pemasukan') ||
    lower.includes('transfer masuk') ||
    lower.includes('penjualan') ||
    lower.includes('dividen') ||
    lower.includes('omset') ||
    lower.includes('profit')
  );

  const hasExpenseActionPrefix = /^(?:bayar|beli|order|isi|belanja|jajan|makan|ngopi)\b/i.test(lower);

  if (isExplicitIncome && !hasExpenseActionPrefix) {
    return {
      nominal,
      type: 'income',
      categoryName: 'Pemasukan',
      categoryEmoji: '💼',
      note: text || 'Pemasukan'
    };
  }

  // 3. Expense Categorization with Explicit Matchers
  let categoryName = 'Lain-lain';
  let categoryEmoji = '💸';

  // Makanan & Minuman
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
  }
  // Transportasi
  else if (
    lower.includes('bensin') || lower.includes('pertamax') || lower.includes('pertalite') ||
    lower.includes('solar') || lower.includes('bbm') || lower.includes('gojek') ||
    lower.includes('grab') || lower.includes('parkir') || lower.includes('tol') ||
    lower.includes('kereta') || lower.includes('krl') || lower.includes('mrt') ||
    lower.includes('lrt') || lower.includes('ojol') || lower.includes('taksi') ||
    lower.includes('taxi') || lower.includes('motor') || lower.includes('mobil') ||
    lower.includes('busway') || lower.includes('transjakarta') || lower.includes('angkot') ||
    lower.includes('servis motor') || lower.includes('ganti oli')
  ) {
    categoryName = 'Transportasi';
    categoryEmoji = '🚗';
  }
  // Hiburan & Lifestyle
  else if (
    lower.includes('nonton') || lower.includes('bioskop') || lower.includes('xxi') ||
    lower.includes('cgv') || lower.includes('game') || lower.includes('steam') ||
    lower.includes('netflix') || lower.includes('spotify') || lower.includes('youtube') ||
    lower.includes('liburan') || lower.includes('karaoke') || lower.includes('hobi') ||
    lower.includes('staycation') || lower.includes('konser') || lower.includes('wisata')
  ) {
    categoryName = 'Hiburan & Lifestyle';
    categoryEmoji = '🎮';
  }
  // Tagihan & Utilitas
  else if (
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
  }
  // Kesehatan & Obat
  else if (
    lower.includes('obat') || lower.includes('apotek') || lower.includes('apotik') ||
    lower.includes('vitamin') || lower.includes('dokter') || lower.includes('klinik') ||
    lower.includes('rs') || lower.includes('rumah sakit') || lower.includes('kesehatan') ||
    lower.includes('medis') || lower.includes('swab') || lower.includes('masker') ||
    lower.includes('terapi') || lower.includes('lab')
  ) {
    categoryName = 'Kesehatan & Obat';
    categoryEmoji = '💊';
  }
  // Belanja & Groceries
  else if (
    lower.includes('baju') || lower.includes('sepatu') || lower.includes('indomaret') ||
    lower.includes('alfamart') || lower.includes('supermarket') || lower.includes('hypermart') ||
    lower.includes('superindo') || lower.includes('belanja') || lower.includes('shopee') ||
    lower.includes('tokopedia') || lower.includes('tokped') || lower.includes('lazada') ||
    lower.includes('mall') || lower.includes('groceries') || lower.includes('pakaian') ||
    lower.includes('tas') || lower.includes('celana')
  ) {
    categoryName = 'Belanja & Groceries';
    categoryEmoji = '👕';
  }
  // Buku & Edukasi
  else if (
    lower.includes('buku') || lower.includes('kursus') || lower.includes('kuliah') ||
    lower.includes('sekolah') || lower.includes('ujian') || lower.includes('les') ||
    lower.includes('seminar') || lower.includes('workshop') || lower.includes('training') ||
    lower.includes('edukasi') || lower.includes('spp') || lower.includes('bootcamp')
  ) {
    categoryName = 'Buku & Edukasi';
    categoryEmoji = '📚';
  }

  return {
    nominal,
    type: 'expense',
    categoryName,
    categoryEmoji,
    note: text || 'Pengeluaran'
  };
}

/**
 * Generate Semantic Fingerprint for Webhook Deduplication
 * Computes deterministic hash to prevent duplicate processing within the deduplication window,
 * even when update_id is missing or varied.
 */
function generateSemanticFingerprint(payload, defaultUserId = 'usr_admin_restu') {
  const msg = payload.message || {};
  const senderId = msg.from?.id || msg.chat?.id || payload.chat_id || defaultUserId;
  const normalizedText = (msg.text || '').trim().toLowerCase();
  const isVoice = !!msg.voice || !!payload.isVoiceNote;
  const isPhoto = !!msg.photo || !!payload.isPhotoReceipt;
  const mediaId = msg.voice?.file_id || (msg.photo && msg.photo[0]?.file_id) || '';

  const hashInput = `${senderId}:${normalizedText}:${isVoice}:${isPhoto}:${mediaId}`;
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

module.exports = {
  parseIndonesianCurrency,
  isSalaryExpense,
  categorizeTelegramMessage,
  generateSemanticFingerprint,
};
