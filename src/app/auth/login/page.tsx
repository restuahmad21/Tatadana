'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowRight, 
  Phone, 
  Mail, 
  Lock, 
  ShieldCheck, 
  Sparkles,
  Bot
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('081234567890');
  const [email, setEmail] = useState('budi@tatadana.id');
  const [password, setPassword] = useState('••••••••');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (authMethod === 'phone' && !otpSent) {
      setTimeout(() => {
        setIsLoading(false);
        setOtpSent(true);
      }, 600);
      return;
    }

    setTimeout(() => {
      setIsLoading(false);
      router.push('/dashboard');
    }, 800);
  };

  return (
    <div className="min-h-screen flex w-full bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      
      {/* KIRI (40%): Branding Panel - Hidden on Mobile */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-zinc-900 via-zinc-950 to-brand-950 p-12 flex-col justify-between relative overflow-hidden border-r border-zinc-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Brand Top */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-amber-500 flex items-center justify-center font-black text-white shadow-lg shadow-brand-500/30">
              TD
            </div>
            <span className="text-2xl font-black text-white tracking-tight">TataDana</span>
          </Link>
        </div>

        {/* Center Tagline */}
        <div className="relative z-10 space-y-4 my-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-400">
            Platform Keuangan Modern
          </span>
          <h2 className="text-4xl font-black text-white leading-tight">
            Keuanganmu.<br />
            <span className="bg-gradient-to-r from-brand-400 to-amber-400 bg-clip-text text-transparent">
              Terkontrol.
            </span>
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
            Masuk dan hubungkan Telegram bot kamu untuk mulai mencatat pemasukan dan pengeluaran secara otomatis.
          </p>

          <div className="pt-6 space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>100% Sinkronisasi Real-Time dengan Telegram</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-brand-500"></span>
              <span>Multi-Wallet & Budget Alert Otomatis</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-zinc-400">
          © 2026 TataDana Indonesia. Enkripsi data Supabase Postgres.
        </div>
      </div>

      {/* KANAN (60%): Form Container - Full Screen on Mobile */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
                Selamat Datang Kembali
              </h1>
              <Link href="/" className="lg:hidden text-xs text-brand-500 font-semibold">
                ← Beranda
              </Link>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Masuk ke akun TataDana untuk mengakses dashboard keuanganmu.
            </p>
          </div>

          {/* Method Tabs: Phone (recommended for Bot Linking) vs Email */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setAuthMethod('phone'); setOtpSent(false); }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
                authMethod === 'phone'
                  ? 'bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Nomor HP (OTP Bot)</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('email')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
                authMethod === 'email'
                  ? 'bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email & Password</span>
            </button>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            {authMethod === 'phone' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Nomor Handphone (WhatsApp / Telegram)
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Nomor HP digunakan untuk autentikasi dan sinkronisasi bot Telegram secara otomatis.
                  </p>
                </div>

                {otpSent && (
                  <div className="space-y-1.5 animate-fade-in">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        Kode OTP (6 Digit)
                      </label>
                      <span className="text-[11px] text-brand-500 font-semibold cursor-pointer">
                        Kirim Ulang OTP
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      autoFocus
                      required
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-brand-500 text-center tracking-[0.5em] text-lg font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                    <p className="text-[11px] text-emerald-500">
                      Kode OTP simulasi telah dikirim ke WhatsApp / Telegram kamu.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Alamat Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Kata Sandi
                    </label>
                    <a href="#" className="text-[11px] text-brand-500 font-semibold hover:underline">
                      Lupa password?
                    </a>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <span>Memverifikasi...</span>
              ) : authMethod === 'phone' && !otpSent ? (
                <span>Kirim Kode OTP</span>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Social Login Separator */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-zinc-200 dark:border-zinc-800 w-full" />
            <span className="bg-slate-50 dark:bg-zinc-950 px-3 text-[11px] text-zinc-400 uppercase tracking-wider absolute">
              atau masuk dengan
            </span>
          </div>

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-850 flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Lanjutkan dengan Google</span>
          </button>

          <p className="text-center text-xs text-zinc-500">
            Belum punya akun?{' '}
            <Link href="/auth/register" className="font-bold text-brand-500 hover:underline">
              Daftar Sekarang
            </Link>
          </p>

        </div>
      </div>

    </div>
  );
}
