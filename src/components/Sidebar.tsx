'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  CreditCard, 
  BarChart3, 
  Target, 
  Wallet as WalletIcon, 
  Settings, 
  Sparkles, 
  LogOut, 
  Sun, 
  Moon, 
  ShieldAlert, 
  MessageCircle,
  Menu,
  X
} from 'lucide-react';

interface SidebarProps {
  userFullName?: string;
  userPhone?: string;
  plan?: 'starter' | 'pro';
  onOpenBotSimulator?: () => void;
}

export default function Sidebar({ 
  userFullName = 'Budi Pratama', 
  userPhone = '081234567890',
  plan = 'pro',
  onOpenBotSimulator
}: SidebarProps) {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleTheme = () => {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    if (isCurrentlyDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tatadana_theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tatadana_theme', 'dark');
      setIsDark(true);
    }
  };

  const navItems = [
    { label: 'Beranda', href: '/dashboard', icon: Home },
    { label: 'Transaksi', href: '/dashboard/transactions', icon: CreditCard },
    { label: 'Laporan', href: '/dashboard/reports', icon: BarChart3 },
    { label: 'Budget', href: '/dashboard/budgets', icon: Target },
    { label: 'Wallet', href: '/dashboard/wallets', icon: WalletIcon },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-850 p-4 transition-colors">
      
      {/* Brand Header */}
      <div className="flex items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-900">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-amber-500 flex items-center justify-center shadow-md shadow-brand-500/20">
            <span className="text-white font-black text-lg">TD</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-zinc-900 dark:text-white">TataDana</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                plan === 'pro' 
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' 
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}>
                {plan === 'pro' ? '👑 PRO' : 'STARTER'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Dashboard Keuangan</p>
          </div>
        </Link>
        <button 
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          title="Toggle Dark/Light"
        >
          <Sun className="w-4 h-4 hidden dark:block text-amber-400" />
          <Moon className="w-4 h-4 block dark:hidden text-zinc-600" />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-500' : 'text-zinc-400'}`} />
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500"></span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Simulator Shortcut Button */}
      {onOpenBotSimulator && (
        <div className="mb-4">
          <button
            onClick={onOpenBotSimulator}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-brand-500/10 to-amber-500/10 border border-brand-500/30 text-brand-600 dark:text-brand-400 hover:from-brand-500/20 hover:to-amber-500/20 transition-all text-xs font-semibold group shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-brand-500 text-white shadow-xs">
                <MessageCircle className="w-3.5 h-3.5" />
              </span>
              <span>Test Bot Telegram</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </button>
        </div>
      )}

      {/* User Footer Profile & Plan */}
      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-500 to-amber-400 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
            {userFullName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
              {userFullName}
            </p>
            <p className="text-[11px] text-zinc-400 font-mono truncate">
              {userPhone}
            </p>
          </div>
          <Link 
            href="/auth/login"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Keluar / Ganti Akun"
          >
            <LogOut className="w-4 h-4" />
          </Link>
        </div>

        {/* Superadmin Quick Access */}
        <Link 
          href="/admin" 
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-brand-500 text-[11px] font-medium border border-zinc-200 dark:border-zinc-800 transition-colors"
        >
          <ShieldAlert className="w-3 h-3 text-brand-500" />
          <span>Superadmin Portal</span>
        </Link>
      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden lg:flex w-64 h-screen flex-col fixed inset-y-0 left-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Top Header with toggle */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Open Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center text-white font-black text-xs">
              TD
            </div>
            <span className="font-bold text-sm text-zinc-900 dark:text-white">TataDana</span>
          </Link>
        </div>

        {onOpenBotSimulator && (
          <button
            onClick={onOpenBotSimulator}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-semibold shadow-xs"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Test Bot</span>
          </button>
        )}
      </div>

      {/* Mobile Sidebar Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] h-full z-50 bg-white dark:bg-zinc-950">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
