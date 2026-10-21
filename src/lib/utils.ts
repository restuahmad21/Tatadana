// TataDana Fintech Utility Functions

/**
 * Format number to Indonesian Rupiah currency format
 * Example: 1500000 -> "Rp1.500.000"
 */
export function formatRupiah(amount: number): string {
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absVal).replace(/\s/g, '');

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format ISO date string into Indonesian formatted date in Asia/Jakarta (WIB) timezone
 */
export function formatWIBDate(
  dateInput: string | Date,
  formatType: 'full' | 'short' | 'time' | 'date-only' = 'full'
): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

  // Options using Asia/Jakarta
  if (formatType === 'time') {
    return date.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';
  }

  if (formatType === 'date-only') {
    return date.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = days[date.getDay()];
  const datePart = date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';

  if (formatType === 'short') {
    return `${datePart}, ${timePart}`;
  }

  return `${dayName}, ${datePart} — ${timePart}`;
}

/**
 * Parse Indonesian informal & formal currency strings:
 * "15rb", "15ribu", "50rb", "50 ribu", "50k" -> 15000, 50000
 * "1.5jt", "1,5jt", "12,5jt", "12.5 juta", "2jt", "2 juta" -> 1500000, 12500000, 2000000
 * "25.000", "25.500", "1.500.000" -> 25000, 25500, 1500000
 * "beli 2 ayam geprek 25.000" -> 25000 (extracts nominal without digit-concatenation error)
 * "Rp 25.000", "Rp 500", "500 perak" -> 25000, 500, 500
 */
export function parseIndonesianCurrency(text: string): number | null {
  if (!text || typeof text !== 'string') return null;
  const str = text.trim();
  if (str.length === 0) return null;

  // 1. Juta / Million: e.g. "12,5jt", "12.5jt", "12,5 juta", "12.5 juta", "1.5jt", "2jt", "2 juta", "12jt"
  const jtMatches = Array.from(str.matchAll(/(?:rp\.?\s*|idr\s*)?(\d+(?:[.,]\d+)?)\s*(?:jt|juta|million)\b/gi));
  if (jtMatches.length > 0) {
    const match = jtMatches[jtMatches.length - 1];
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return Math.round(val * 1000000);
  }

  // 2. Ribu / Thousand / k: e.g. "50rb", "50 rb", "50ribu", "50 ribu", "50k", "50 k", "12,5rb", "12.5rb", "2.5k"
  const rbMatches = Array.from(str.matchAll(/(?:rp\.?\s*|idr\s*)?(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/gi));
  if (rbMatches.length > 0) {
    const match = rbMatches[rbMatches.length - 1];
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return Math.round(val * 1000);
  }

  // 3. Indonesian / standard thousands separator: e.g. "25.000", "25.500", "1.500.000", "12.500.000", "25,000", "25.000,-"
  const sepMatches = Array.from(str.matchAll(/(?:rp\.?\s*|idr\s*)?(\d{1,3}(?:[.,]\d{3})+(?:,-\b|\b))/gi));
  if (sepMatches.length > 0) {
    const match = sepMatches[sepMatches.length - 1];
    const raw = match[1].replace(/[.,]/g, '').replace(',-', '');
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 4. Currency prefix with any plain number: e.g. "Rp 25000", "Rp. 500", "rp5000", "IDR 100000"
  const rpMatches = Array.from(str.matchAll(/(?:rp\.?\s*|idr\s*)(\d+)/gi));
  if (rpMatches.length > 0) {
    const match = rpMatches[rpMatches.length - 1];
    const val = parseInt(match[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 5. Suffix currency unit: e.g. "25000 rupiah", "500 perak"
  const suffixMatches = Array.from(str.matchAll(/\b(\d+)\s*(?:rupiah|perak)\b/gi));
  if (suffixMatches.length > 0) {
    const match = suffixMatches[suffixMatches.length - 1];
    const val = parseInt(match[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 6. Plain numbers of 4+ digits (>= 1000 IDR): e.g. "25000", "beli 2 ayam geprek 25000"
  const plainNums = Array.from(str.matchAll(/\b(\d{4,})\b/g));
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
 * Returns true if text indicates paying employee/helper salary (EXPENSE)
 * e.g. "gaji supir 1.5jt", "bayar gaji pembantu 2jt", "gaji karyawan 3jt"
 */
export function isSalaryExpense(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  const payingVerbPatterns = /(?:bayar|membayar|bayarin|kasih|ngasih|biaya|pengeluaran|keluar|transfer)\s+(?:gaji|upah|honor)/i;
  const recipientPatterns = /(?:gaji|upah|honor)\s+(?:supir|sopir|pembantu|art|karyawan|staf|staff|pegawai|babysitter|baby\s+sitter|pengasuh|satpam|security|tukang|suster|asisten|pekerja|ob|intern|magang|montir|perawat|honorer)/i;
  const bayarPrefixWithGaji = /bayar\b.*?\b(?:gaji|upah|honor)\b/i;

  return payingVerbPatterns.test(lower) || recipientPatterns.test(lower) || bayarPrefixWithGaji.test(lower);
}


/**
 * Generate Visual ASCII progress bar for Telegram bot messages
 * Example: generateProgressBar(75, 10) -> "███████░░░"
 */
export function generateProgressBar(percentage: number, totalBlocks = 10): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const filledBlocks = Math.round((clamped / 100) * totalBlocks);
  const emptyBlocks = Math.max(0, totalBlocks - filledBlocks);

  return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
}

/**
 * Mask sensitive API key or token
 * "sk-proj-1234567890abcdef" -> "sk-proj-••••••••cdef"
 */
export function maskSecret(secret: string): string {
  if (!secret) return '••••••••';
  if (secret.length <= 8) return '••••••••';
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Generate human-readable time elapsed
 */
export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  return `${Math.floor(diffSec / 86400)} hari lalu`;
}

/**
 * Check plan enforcement
 */
export const PLAN_LIMITS = {
  starter: {
    maxMonthlyTransactions: 50,
    maxWallets: 3,
    maxBudgets: 5,
    allowReceiptOCR: false,
    allowFinancialAdvisor: false,
    allowAdvancedExport: false,
  },
  pro: {
    maxMonthlyTransactions: Infinity,
    maxWallets: Infinity,
    maxBudgets: Infinity,
    allowReceiptOCR: true,
    allowFinancialAdvisor: true,
    allowAdvancedExport: true,
  },
};
