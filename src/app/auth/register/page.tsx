'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowRight, 
  Phone, 
  User, 
  Sparkles, 
  CheckCircle2, 
  Lock,
  Wallet,
  Tag
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Form & OTP, Step 2: AI Onboarding Recommendation
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profession, setProfession] = useState('Karyawan Swasta');
  const [monthlyIncome, setMonthlyIncome] = useState('5jt - 10jt');
  const [isLoading, setIsLoading] = useState(false);

  // AI Recommended Categories Preview
  const [recommendedCategories, setRecommendedCategories] = useState([
    { name: '🍜 Makanan & Kopi', emoji: '🍜', color: '#f97316' },
    { name: '🚗 Transport & Bensin', emoji: '🚗', color: '#0ea5e9' },
    { name: '🏠 Kost / Tagihan Bulanan', emoji: '🏠', color: '#ef4444' },
    { name: '🎮 Hangout & Hiburan', emoji: '🎮', color: '#8b5cf6' },
    { name: '💰 Gaji Pokok', emoji: '💰', color: '#10b981' },
    { name: '👕 Belanja Online', emoji: '👕', color: '#ec4899' },
  ]);

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep(2);
    }, 700);
  };

  const handleCompleteRegistration = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push('/dashboard');
    }, 800);
  };

  return (
    <div className="min-h-screen flex w-full bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      
      {/* KIRI (40%): Branding Panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-zinc-900 via-zinc-950 to-brand-950 p-12 flex-col justify-between relative overflow-hidden border-r border-zinc-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-amber-500 flex items-center justify-center font-black text-white shadow-lg shadow-brand-500/30">
              TD
            </div>
            <span className="text-2xl font-black text-white tracking-tight">TataDana</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-4 my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Category Onboarding</span>
          </div>

          <h2 className="text-4xl font-black text-white leading-tight">
            Mulai Disiplin Finansial Bersama TataDana.
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
            Setelah registrasi, AI kami akan otomatis menyiapkan dompet default dan kategori pengeluaran yang dipersonalisasi sesuai profilmu.
          </p>

          <div className="pt-4 space-y-2.5 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Verifikasi nomor HP via OTP instant</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Link akun otomatis ke @TataDanaOfficialBot</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Struktur laporan siap pakai saat transaksi pertama</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-zinc-400">
          © 2026 TataDana Indonesia.
        </div>
      </div>

      {/* KANAN (60%): Registration & AI Onboarding Form */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          
          {step === 1 ? (
            <>
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
                  Buat Akun TataDana
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                  Masukkan data diri untuk memulai pencatatan keuangan via Telegram.
                </p>
              </div>

              <form onSubmit={handleStep1Submit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Budi Pratama"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Nomor WhatsApp / Handphone
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="081234567890"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-mono"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Kunci identitas untuk sinkronisasi bot Telegram kamu.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Profesi Saat Ini
                  </label>
                  <select
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Karyawan Swasta">Karyawan Swasta</option>
                    <option value="Mahasiswa">Mahasiswa</option>
                    <option value="Freelancer">Freelancer / Kreator Konten</option>
                    <option value="Wiraswasta">Wirausaha / UMKM</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Estimasi Penghasilan Bulanan
                  </label>
                  <select
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="< 3jt">&lt; Rp3.000.000</option>
                    <option value="3jt - 5jt">Rp3.000.000 - Rp5.000.000 (UMK)</option>
                    <option value="5jt - 10jt">Rp5.000.000 - Rp10.000.000</option>
                    <option value="> 10jt">&gt; Rp10.000.000</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {isLoading ? (
                    <span>Menghubungkan AI Onboarding...</span>
                  ) : (
                    <>
                      <span>Lanjut ke Personalisasi AI</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-xs text-zinc-500">
                Sudah punya akun?{' '}
                <Link href="/auth/login" className="font-bold text-brand-500 hover:underline">
                  Masuk di sini
                </Link>
              </p>
            </>
          ) : (
            /* STEP 2: AI Recommended Category Setup */
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Rekomendasi AI TataDana</span>
                </div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white">
                  Kategori Awal Berdasarkan Profilmu
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Untuk <strong>{profession}</strong> dengan penghasilan <strong>{monthlyIncome}</strong>, AI merekomendasikan set kategori dan dompet default ini:
                </p>
              </div>

              {/* Default Wallet Preview */}
              <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-500 flex items-center justify-center font-bold">
                    👛
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Dompet Utama (BCA)</h4>
                    <p className="text-[11px] text-zinc-400">Set sebagai default untuk transaksi bot Telegram</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">
                  DEFAULT
                </span>
              </div>

              {/* Recommended Categories Badges */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Kategori Pengeluaran & Pemasukan (Dapat diedit nanti):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {recommendedCategories.map((cat, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-2 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      <span>{cat.emoji}</span>
                      <span className="truncate">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCompleteRegistration}
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span>Mempersiapkan Dashboard...</span>
                  ) : (
                    <>
                      <span>Simpan & Masuk ke Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
