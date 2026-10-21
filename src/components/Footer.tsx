import React from 'react';
import Link from 'next/link';
import { Send, Shield, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-zinc-950 text-zinc-400 border-t border-zinc-900 pt-16 pb-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          
          {/* Kolom 1: Brand & Bio (2 cols wide on desktop) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-amber-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <span className="text-white font-black text-xl">TD</span>
              </div>
              <div>
                <span className="font-extrabold text-xl text-white tracking-tight">TataDana</span>
                <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  INDONESIA
                </span>
              </div>
            </div>
            
            <p className="text-sm text-zinc-400 leading-relaxed max-w-sm">
              Catat keuangan semudah chat — langsung dari Telegram kamu. Bantu karyawan, mahasiswa, dan freelancer Indonesia mengontrol cashflow tanpa ribet membuka aplikasi manual.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <a 
                href="https://t.me" 
                target="_blank" 
                rel="noreferrer"
                className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-brand-400 hover:border-brand-500/40 transition-colors"
                aria-label="Telegram"
              >
                <Send className="w-4 h-4" />
              </a>
              <span className="text-xs text-zinc-500 font-mono">@TataDanaOfficialBot</span>
            </div>
          </div>

          {/* Kolom 2: Produk */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase">Produk</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="#fitur" className="hover:text-brand-400 transition-colors">Catat via Telegram</Link></li>
              <li><Link href="#fitur" className="hover:text-brand-400 transition-colors">Voice Note Transkripsi</Link></li>
              <li><Link href="#fitur" className="hover:text-brand-400 transition-colors">OCR Foto Struk (Pro)</Link></li>
              <li><Link href="#fitur" className="hover:text-brand-400 transition-colors">AI Financial Advisor</Link></li>
              <li><Link href="#fitur" className="hover:text-brand-400 transition-colors">Laporan & Export Excel/PDF</Link></li>
              <li><Link href="#harga" className="hover:text-brand-400 transition-colors">Paket Subscription</Link></li>
            </ul>
          </div>

          {/* Kolom 3: Perusahaan */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase">Perusahaan</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/" className="hover:text-brand-400 transition-colors">Tentang TataDana</Link></li>
              <li><Link href="/" className="hover:text-brand-400 transition-colors">Misi Literasi Finansial</Link></li>
              <li><Link href="/" className="hover:text-brand-400 transition-colors">Karir & Internship</Link></li>
              <li><Link href="/" className="hover:text-brand-400 transition-colors">Blog & Edukasi UMK</Link></li>
              <li><Link href="/" className="hover:text-brand-400 transition-colors">Hubungi Support</Link></li>
            </ul>
          </div>

          {/* Kolom 4: Legal & Keamanan */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase">Legal & Privasi</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/" className="hover:text-brand-400 transition-colors">Kebijakan Privasi</Link></li>
              <li><Link href="/" className="hover:text-brand-400 transition-colors">Syarat & Ketentuan</Link></li>
              <li><Link href="/" className="hover:text-brand-400 transition-colors">Keamanan Data Postgres</Link></li>
              <li><Link href="/" className="hover:text-brand-400 transition-colors">Midtrans Escrow Guarantee</Link></li>
              <li><Link href="/admin" className="hover:text-brand-400 transition-colors">Audit Trail Portal</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <p>© 2026 TataDana Indonesia. Seluruh hak cipta dilindungi undang-undang.</p>
          <div className="flex items-center gap-2">
            <span>Dibuat dengan standar fintech premium</span>
            <span className="text-brand-500">•</span>
            <span className="flex items-center gap-1 text-zinc-300">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              Supabase 256-bit Encrypted
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}
