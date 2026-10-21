'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TelegramSimulatorModal from '@/components/TelegramSimulatorModal';
import { 
  Sparkles, 
  ArrowRight, 
  Play, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  FileSpreadsheet, 
  Bot, 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  Receipt, 
  Mic, 
  Lock, 
  HelpCircle,
  ChevronDown,
  Smartphone,
  PieChart,
  BarChart,
  DollarSign
} from 'lucide-react';

export default function LandingPage() {
  const [pricingCycle, setPricingCycle] = useState<'monthly' | 'lifetime'>('lifetime');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [activeTabDemo, setActiveTabDemo] = useState<'text' | 'voice' | 'receipt'>('text');

  const faqs = [
    {
      q: 'Bagaimana cara menghubungkan Telegram saya dengan TataDana?',
      a: 'Sangat mudah! Setelah mendaftar di web TataDana, masukkan nomor HP Anda. Lalu buka @TataDanaOfficialBot di Telegram atau bot pribadi Anda, klik Start, dan akun Anda otomatis tersinkronisasi dalam 5 detik.'
    },
    {
      q: 'Apakah bisa mencatat pengeluaran lewat foto struk belanja di paket Starter?',
      a: 'Fitur input via foto struk belanja dengan OCR multi-item adalah fitur eksklusif untuk paket Pro. Untuk paket Starter, Anda bisa mencatat transaksi via teks natural dan voice note hingga 50 transaksi per bulan.'
    },
    {
      q: 'Bagaimana keamanan data transaksi saya di TataDana?',
      a: 'Data transaksi dan dompet Anda 100% tersimpan aman di database Supabase Postgres dengan enkripsi tingkat bank dan isolasi Row Level Security (RLS). Tidak ada pihak ketiga yang memiliki akses ke riwayat transaksi pribadi Anda.'
    },
    {
      q: 'Apakah saya harus membuat bot Telegram sendiri di @BotFather?',
      a: 'Tidak wajib! TataDana menyediakan 1 Official Master Bot yang bisa langsung digunakan bersama. Namun, jika Anda ingin memiliki bot eksklusif dengan nama dan foto profil sendiri (BYOB), Anda bisa memasukkan token BotFather Anda di menu Settings.'
    },
    {
      q: 'Apakah bot mengenali format nominal bahasa Indonesia gaul?',
      a: 'Ya, 100%! Sistem AI kami dilatih khusus untuk memahami format Indonesia seperti "15rb", "15ribu", "1.5jt", "2,5jt", "500k", hingga bahasa sehari-hari seperti "makan padang 25rb" atau "gajian 6jt".'
    },
    {
      q: 'Bagaimana cara kerja AI Financial Advisor di paket Pro?',
      a: 'AI Financial Advisor akan otomatis menganalisis pola pengeluaran Anda. Jika ada kategori yang membengkak lebih dari 50% dibanding minggu lalu atau melebihi 80% dari batas budget, bot akan memberikan insight dan saran actionable langsung di chat.'
    },
    {
      q: 'Metode pembayaran apa saja yang didukung?',
      a: 'Kami menerima pembayaran otomatis melalui Midtrans (QRIS, GoPay, OVO, ShopeePay, Virtual Account BCA/Mandiri/BRI/BNI) serta transfer bank manual yang dapat diverifikasi oleh tim support kami.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors">
      <Navbar />

      {/* Floating Quick Simulator Trigger */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setBotModalOpen(true)}
          className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-xl shadow-brand-500/30 hover:scale-105 active:scale-95 transition-all"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
          <MessageSquare className="w-4 h-4" />
          <span>Coba Bot Telegram Sekarang</span>
        </button>
      </div>

      {/* SECTION 1: HERO */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-brand-500/20 to-amber-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          
          {/* Pre-headline Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs sm:text-sm font-semibold tracking-wide">
            <Sparkles className="w-4 h-4 animate-spin-slow text-brand-500" />
            <span>✨ Catat keuangan langsung dari Telegram</span>
          </div>

          {/* Headline H1 */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900 dark:text-white leading-[1.15]">
            Gaji habis sebelum akhir bulan?{' '}
            <span className="bg-gradient-to-r from-brand-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
              Sudah saatnya kamu tahu ke mana uangmu pergi.
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
            TataDana mencatat setiap pengeluaranmu langsung dari chat Telegram atau foto struk — sisanya kami yang urus.
          </p>

          {/* CTA Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-base shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              <span>Mulai Gratis Sekarang</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            <a
              href="#cara-kerja"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 font-semibold text-base transition-all flex items-center justify-center gap-2"
            >
              <span>Lihat cara kerjanya →</span>
            </a>
          </div>

          {/* Hero Section Video Placeholder */}
          {/* TODO: ganti dengan video asli demo TataDana */}
          <div className="pt-10 max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-2 sm:p-4 shadow-2xl">
              <div className="relative aspect-video rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 flex flex-col items-center justify-center p-6 text-center group border border-zinc-800/80">
                <div 
                  onClick={() => setBotModalOpen(true)}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-brand-500/90 text-white flex items-center justify-center shadow-xl shadow-brand-500/40 cursor-pointer group-hover:scale-110 transition-transform mb-4"
                >
                  <Play className="w-8 h-8 ml-1 fill-white" />
                </div>
                <h3 className="text-white font-bold text-lg sm:text-xl">
                  Video Demo: Catat Pengeluaran dalam 3 Detik
                </h3>
                <p className="text-zinc-400 text-xs sm:text-sm mt-1 max-w-md">
                  Tonton bagaimana Budi mencatat kopi 25rb hanya dengan mengetik di chat Telegram tanpa membuka aplikasi ribet.
                </p>
                <div className="mt-4 px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700 text-[11px] text-zinc-400 font-mono">
                  // Placeholder Video Player (Klik untuk buka live simulator)
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 2: PROBLEM AWARE BULLETS & SOLUTION */}
      <section className="py-20 bg-white dark:bg-zinc-900/60 border-y border-zinc-200 dark:border-zinc-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
              Kenapa mencatat keuangan manual selalu gagal?
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Kamu tidak malas — tools yang kamu pakai selama ini yang terlalu menyulitkan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {/* Problem 1 */}
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-bold">
                <XCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                "Buka aplikasi keuangan? Nanti dulu deh..."
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Harus unlock HP, cari aplikasi, pilih akun, pilih kategori dropdown, ketik nominal... terlalu ribet sampai akhirnya ditunda dan lupa selamanya.
              </p>
            </div>

            {/* Problem 2 */}
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <XCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                "Kok uangnya habis ya? Padahal kayak tidak beli apa-apa"
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Pengeluaran kecil 15rb, 20rb, 35rb (kopi, parkir, jajan) bocor halus setiap hari tanpa tercatat, tiba-tiba saldo rekening sudah menipis.
              </p>
            </div>

            {/* Problem 3 */}
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center font-bold">
                <XCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                "Udah niat bikin budget, tapi seminggu lupa"
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Budget yang dibuat rapi di spreadsheet di awal bulan tidak pernah dilihat lagi. Tidak ada pengingat otomatis saat kantong mulai jebol.
              </p>
            </div>
          </div>

          {/* Solusi Transition */}
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-tr from-brand-500/10 via-amber-500/5 to-transparent border border-brand-500/20 text-center space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Solusi Yang Berhasil
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
              Bagaimana kalau mencatat keuangan semudah kirim pesan ke teman?
            </h3>
            <p className="text-base text-zinc-600 dark:text-zinc-300 max-w-xl mx-auto">
              Memperkenalkan <strong>TataDana</strong> — aplikasi pencatat keuangan yang hidup di dalam aplikasi chat yang sudah kamu buka puluhan kali sehari.
            </p>
          </div>

        </div>
      </section>

      {/* SECTION 3: INTERACTIVE DEMO PREVIEW */}
      <section id="cara-kerja" className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-500">Interactive Preview</span>
          <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
            Lihat Format Balasan Bot TataDana
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Coba klik variasi input di bawah untuk melihat bagaimana sistem merespon secara instan.
          </p>
        </div>

        {/* Demo Box */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {/* Mode Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            <button
              onClick={() => setActiveTabDemo('text')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTabDemo === 'text'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              💬 Teks Natural ("Beli Bakso 15rb")
            </button>
            <button
              onClick={() => setActiveTabDemo('voice')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTabDemo === 'voice'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              🎙️ Voice Note (Audio 60s)
            </button>
            <button
              onClick={() => setActiveTabDemo('receipt')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTabDemo === 'receipt'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              📸 Foto Struk Belanja (Pro OCR)
            </button>
          </div>

          {/* Interactive Chat Mock */}
          <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            
            {/* User message */}
            <div className="flex justify-end">
              <div className="bg-brand-500 text-white rounded-2xl rounded-tr-xs p-3.5 text-xs sm:text-sm max-w-[85%] shadow">
                {activeTabDemo === 'text' && (
                  <span>Beli bakso urat + es teh 15rb</span>
                )}
                {activeTabDemo === 'voice' && (
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    <span>Voice Note (0:04)</span>
                    <span className="text-xs opacity-75">▶ ılılıllı</span>
                  </div>
                )}
                {activeTabDemo === 'receipt' && (
                  <div>
                    <div className="w-48 h-28 bg-zinc-800 rounded-lg flex items-center justify-center text-xs text-brand-200 border border-brand-400/40 mb-1">
                      📸 [Foto Struk Indomaret]
                    </div>
                    <span>Belanja mingguan</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bot Response formatted per requirements */}
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                TD
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl rounded-tl-xs p-4 text-xs font-mono text-zinc-200 leading-relaxed max-w-[90%]">
                {activeTabDemo === 'voice' && (
                  <div className="mb-2 text-brand-300 font-sans text-xs">
                    🎙️ <em>Transkrip: "Beli bensin pertamax di spbu lima puluh ribu"</em>
                  </div>
                )}
                📅 Sabtu, 10 Okt 2026 — 12:15 WIB<br />
                💸 <strong>Pengeluaran tercatat!</strong><br />
                ├ Nominal : <strong>{activeTabDemo === 'receipt' ? 'Rp84.500' : (activeTabDemo === 'voice' ? 'Rp50.000' : 'Rp15.000')}</strong><br />
                ├ Kategori : {activeTabDemo === 'receipt' ? '🛒 Belanja' : (activeTabDemo === 'voice' ? '🚗 Transportasi' : '🍜 Makanan & Minuman')}<br />
                ├ Dompet : 👛 BCA Utama<br />
                ├ Catatan : {activeTabDemo === 'receipt' ? 'Struk Indomaret Point (3 item)' : (activeTabDemo === 'voice' ? 'Pertamax SPBU' : 'Beli bakso urat + es teh')}<br />
                └ Saldo : <strong>Rp9.485.000</strong><br /><br />
                📊 <strong>Budget bulan ini:</strong><br />
                [████░░░░░░] 38% — sisa Rp930.000<br />
                <span className="text-emerald-400 font-sans">👍 Pengeluaran masih aman sesuai alokasi!</span>

                {activeTabDemo === 'receipt' && (
                  <div className="mt-3 pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 font-sans">
                    ✨ <em>Tercatat sebagai 1 transaksi di web & 3 baris item di Google Sheets.</em>
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setBotModalOpen(true)}
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold underline underline-offset-4"
            >
              Coba langsung ketik transaksimu di Simulator Lengkap →
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 4: 3 FITUR UTAMA (Alternating Layout) */}
      <section id="fitur" className="py-20 bg-slate-100/60 dark:bg-zinc-900/40 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
          
          {/* Fitur 1: Catat via Telegram (Teks & Foto) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-500">Fitur 01</span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
                Catat dalam 3 Detik: Bahasa Gaul, Voice Note, atau Struk
              </h3>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Tidak ada form yang harus diisi. Cukup chat seperti kirim pesan ke teman. Engine LLM TataDana mengenali nominal 15rb, 1.5jt, hingga 500k dan langsung memetakan kategori serta dompet secara akurat.
              </p>
              <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Parsing multimodal dengan Google Gemini 2.0 & OpenAI</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Dukungan voice note hingga 60 detik dengan transkripsi presisi</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Ekstraksi struk belanja multi-item (Paket Pro)</span>
                </li>
              </ul>
            </div>
            <div className="p-6 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-xl">
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800 pb-2">
                  <span>Chat Input Example</span>
                  <span className="text-emerald-400">● 99.9% Parser Accuracy</span>
                </div>
                <div className="text-xs font-mono space-y-1.5 text-zinc-300">
                  <p>User: "Gaji freelance 3.5jt"</p>
                  <p className="text-emerald-400">→ +Rp3.500.000 (Pemasukan: Project Freelance)</p>
                  <p className="pt-2">User: "Beli boba 28k"</p>
                  <p className="text-orange-400">→ -Rp28.000 (Pengeluaran: Makanan & Minuman)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Fitur 2: Laporan & Export Otomatis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center lg:flex-row-reverse">
            <div className="space-y-4 lg:order-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-500">Fitur 02</span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
                Dashboard Laporan Lengkap & Export PDF / Excel Sekali Klik
              </h3>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Semua data dari Telegram langsung terakumulasi rapi di web dashboard. Filter per rentang tanggal, lihat perbandingan pemasukan vs pengeluaran, dan unduh laporan resmi kapan saja.
              </p>
              <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Sinkronisasi instan via Supabase Realtime tanpa refresh manual</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Download file Excel (.xlsx) dan PDF dengan signed URL aman</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Expand detail item untuk transaksi dari foto struk</span>
                </li>
              </ul>
            </div>
            <div className="p-6 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-xl lg:order-1">
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Ringkasan Bulan Ini</span>
                  <span className="text-brand-400 font-mono text-[11px]">OCT 2026</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-400 text-[10px]">Total Masuk</span>
                    <p className="text-emerald-400 font-bold text-sm">Rp8.500.000</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-400 text-[10px]">Total Keluar</span>
                    <p className="text-orange-400 font-bold text-sm">Rp3.150.000</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="flex-1 py-1.5 rounded-lg bg-zinc-800 text-center text-[11px] text-zinc-300 font-medium">
                    📄 Export PDF Siap
                  </div>
                  <div className="flex-1 py-1.5 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 text-center text-[11px] font-medium">
                    📊 Export Excel Siap
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fitur 3: AI Financial Advisor */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-500">Fitur 03</span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
                AI Financial Advisor: Deteksi Kebocoran Uang Otomatis
              </h3>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Bukan sekadar pencatat pasif. TataDana bertindak seperti konsultan keuangan pribadi yang mendeteksi anomali pengeluaran dan memberikan saran konkret agar kamu tidak kehabisan uang di akhir bulan.
              </p>
              <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Peringatan instan saat kategori melonjak &gt;50% dibanding minggu lalu</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Alert saat total pengeluaran sudah memakan 80% dari gaji</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Saran praktis dan personal, bukan tips generik buku pelajaran</span>
                </li>
              </ul>
            </div>
            <div className="p-6 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-xl">
              <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-500/30 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                  <Bot className="w-4 h-4" />
                  <span>AI Financial Advisor (Pro)</span>
                </div>
                <p className="text-xs text-purple-200 leading-relaxed">
                  "Hei Budi! Pengeluaran kopi & jajan kamu minggu ini naik <strong>62%</strong> dibanding minggu lalu (sudah Rp435.000). Alokasi budget hiburan tersisa hanya Rp80.000."
                </p>
                <div className="p-2.5 rounded-xl bg-purple-900/40 border border-purple-500/20 text-[11px] text-purple-300">
                  💡 <strong>Saran:</strong> Kurangi delivery kopi ke kantor dan seduh kopi sendiri selama 5 hari ke depan untuk menyelamatkan cashflow akhir bulan!
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 5: TESTIMONI (Masonry Grid Placeholder) */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-500">Testimoni Pengguna</span>
          <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
            Disukai Oleh Karyawan & Freelancer Indonesia
          </h2>
          <p className="text-xs text-zinc-400">
            {/* TODO: ganti dengan testimoni asli setelah beta tester live */}
            *Testimoni awal dari cohort pengujian tertutup TataDana Beta
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center text-sm">
                AR
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Andi Ramadhan</h4>
                <p className="text-xs text-zinc-500">Software Engineer · Jakarta</p>
              </div>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              "Dulu selalu malas buka aplikasi budgeting. Sekarang habis bayar parkir atau makan siang, langsung ketik di Telegram 'bakso 20rb' sambil jalan. Bulan ini pertama kalinya sisa gaji masih ada 35%!"
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-sm">
                DK
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Dian Kartika</h4>
                <p className="text-xs text-zinc-500">Freelance Designer · Bandung</p>
              </div>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              "Fitur foto struk di paket Pro bener-bener penyelamat. Tiap abis belanja bulanan di supermarket tinggal foto struknya, itemnya langsung dipecah rapi. Worth it banget Rp99rb sekali bayar."
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-sm">
                FS
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Fajar Setiawan</h4>
                <p className="text-xs text-zinc-500">Account Executive · Surabaya</p>
              </div>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              "AI Financial Advisor-nya ngebantu banget. Waktu kemarin keasikan nongkrong, bot-nya langsung ngingetin kalau jajan udah 80% dari batas. Bikin lebih sadar diri sebelum gesek kartu."
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 6: PRICING (Starter vs Pro) */}
      <section id="harga" className="py-20 bg-slate-100/60 dark:bg-zinc-900/60 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-500">Pilihan Paket</span>
            <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
              Investasi Kecil untuk Kontrol Keuangan Selamanya
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Pilih paket yang sesuai dengan kebutuhan pencatatanmu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* Starter Plan */}
            <div className="p-8 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Starter
                  </span>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white">Rp49.000</span>
                    <span className="text-xs text-zinc-400">/ bulan</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">Cocok untuk pemula yang ingin mulai disiplin mencatat pengeluaran.</p>
                </div>

                <ul className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Catat transaksi via teks & voice note Telegram</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Maksimal <strong>50 transaksi/bulan</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Maksimal 3 dompet & 5 kategori budget</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Dashboard web lengkap ringkasan bulanan</span>
                  </li>
                  <li className="flex items-center gap-2 text-zinc-400">
                    <XCircle className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Tanpa input foto struk AI OCR</span>
                  </li>
                  <li className="flex items-center gap-2 text-zinc-400">
                    <XCircle className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Tanpa AI Financial Advisor & export PDF/Excel</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <Link
                  href="/auth/register?plan=starter"
                  className="w-full py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white font-semibold text-xs text-center block transition-colors"
                >
                  Pilih Starter
                </Link>
              </div>
            </div>

            {/* Pro Plan (Best Value) */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-brand-500/10 via-zinc-950 to-zinc-950 border-2 border-brand-500 shadow-2xl relative flex flex-col justify-between">
              <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-brand-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-md">
                👑 PALING POPULER
              </div>

              <div className="space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-brand-500/20 text-brand-500 dark:text-brand-400">
                    Pro Lifetime
                  </span>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white">Rp99.000</span>
                    <span className="text-xs text-brand-400 font-semibold">/ Sekali Bayar</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">Akses penuh selamanya tanpa biaya langganan bulanan.</p>
                </div>

                <ul className="space-y-3 text-xs text-zinc-200">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0" />
                    <span><strong>UNLIMITED</strong> transaksi, dompet, & budget</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0" />
                    <span><strong>Input Foto Struk</strong> dengan AI OCR multi-item</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0" />
                    <span><strong>AI Financial Advisor</strong> aktif proaktif</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0" />
                    <span><strong>Export Unlimited</strong> ke PDF & Excel (.xlsx)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0" />
                    <span>Filter & pencarian lanjutan di dashboard laporan</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0" />
                    <span>Reminder custom hingga 2x sehari & prioritas support</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <Link
                  href="/auth/register?plan=pro"
                  className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs text-center block shadow-lg shadow-brand-500/30 transition-all hover:scale-102"
                >
                  Ambil Pro Sekarang (Rp99.000)
                </Link>
                <p className="text-[10px] text-center text-zinc-400 mt-2">
                  Dukung pembayaran instan Midtrans (QRIS, VA) & Transfer Bank
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 7: FAQ (Min 7 Items) */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-500">Tanya Jawab</span>
          <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
            Pertanyaan Yang Sering Diajukan
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Punya pertanyaan lain? Tim kami siap membantu di grup komunitas Telegram.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-zinc-900 dark:text-white hover:text-brand-500"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform ${
                    openFaq === idx ? 'rotate-180 text-brand-500' : ''
                  }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-900 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 8: FINAL CTA */}
      <section className="py-20 bg-gradient-to-r from-brand-600 via-orange-500 to-amber-500 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Mulai kendalikan keuanganmu hari ini.
          </h2>
          <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto">
            Tidak ada lagi uang lenyap tanpa jejak. Catat transaksi semudah chat langsung dari ponselmu sekarang juga.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="px-8 py-3.5 rounded-2xl bg-white text-brand-600 font-extrabold text-sm shadow-xl hover:bg-zinc-100 transition-all hover:scale-105"
            >
              Daftar Gratis Sekarang
            </Link>
            <button
              onClick={() => setBotModalOpen(true)}
              className="px-6 py-3.5 rounded-2xl bg-black/20 hover:bg-black/30 border border-white/20 text-white font-semibold text-sm transition-all"
            >
              Coba Chat Telegram Dulu
            </button>
          </div>
        </div>
      </section>

      <Footer />

      {/* Interactive Telegram Simulator Modal */}
      <TelegramSimulatorModal
        isOpen={botModalOpen}
        onClose={() => setBotModalOpen(false)}
      />
    </div>
  );
}
