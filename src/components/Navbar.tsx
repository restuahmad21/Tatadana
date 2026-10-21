'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sun, Moon, ArrowRight, MessageSquare, Shield, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isDark, setIsDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Check initial dark mode from document or storage
    if (typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const stored = localStorage.getItem('tatadana_theme');
      if (stored === 'dark' || (!stored && prefersDark)) {
        setIsDark(true);
        document.documentElement.classList.add('dark');
      } else {
        setIsDark(false);
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tatadana_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tatadana_theme', 'light');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 dark:bg-zinc-950/80 border-b border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-amber-500 flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <span className="text-white font-black text-xl tracking-tighter">TD</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-zinc-900 dark:text-white">TataDana</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400">
                Fintech
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 -mt-0.5 hidden sm:block">Chat. Catat. Beres.</p>
          </div>
        </Link>

        {/* Desktop Nav Items */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-600 dark:text-zinc-300">
          <Link href="#fitur" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
            Fitur
          </Link>
          <Link href="#cara-kerja" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
            Cara Kerja
          </Link>
          <Link href="#harga" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
            Harga
          </Link>
          <Link href="#faq" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
            FAQ
          </Link>
          <Link href="/admin" className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-brand-600 flex items-center gap-1 border border-zinc-200 dark:border-zinc-800">
            <Shield className="w-3 h-3" />
            Admin
          </Link>
        </nav>

        {/* Actions & Theme Switcher */}
        <div className="hidden md:flex items-center gap-3">
          {/* Dark / Light Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            title={isDark ? "Ganti ke Tema Terang" : "Ganti ke Tema Gelap"}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-zinc-600" />}
          </button>

          <Link 
            href="/auth/login" 
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            Masuk
          </Link>

          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 shadow-md shadow-brand-500/25 transition-all hover:shadow-brand-500/40 active:scale-95"
          >
            <span>Buka Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400"
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 pt-2 pb-6 space-y-3">
          <Link 
            href="#fitur" 
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Fitur
          </Link>
          <Link 
            href="#cara-kerja" 
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Cara Kerja
          </Link>
          <Link 
            href="#harga" 
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Harga
          </Link>
          <Link 
            href="#faq" 
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            FAQ
          </Link>
          <Link 
            href="/admin" 
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-brand-600 dark:text-brand-400"
          >
            Admin Dashboard
          </Link>
          <div className="pt-2 flex flex-col gap-2">
            <Link 
              href="/auth/login"
              className="w-full text-center py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-700 rounded-xl"
            >
              Masuk
            </Link>
            <Link 
              href="/dashboard"
              className="w-full text-center py-2 text-sm font-semibold text-white bg-brand-500 rounded-xl"
            >
              Buka Dashboard
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
