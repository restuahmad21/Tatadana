'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  getInitialState, 
  AppState 
} from '@/lib/store';
import { 
  formatRupiah, 
  formatWIBDate 
} from '@/lib/utils';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Target, 
  Calendar, 
  Plus, 
  CheckCircle, 
  Circle, 
  TrendingUp, 
  Receipt, 
  ArrowRight,
  Filter,
  CreditCard,
  MessageSquare
} from 'lucide-react';

export default function DashboardOverviewPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    setState(getInitialState());

    const handleSync = () => {
      setState(getInitialState());
    };

    window.addEventListener('tatadana_state_changed', handleSync);
    return () => window.removeEventListener('tatadana_state_changed', handleSync);
  }, []);

  if (!state) {
    // Loading skeleton per requirements
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-zinc-200 dark:bg-zinc-900 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Calculations
  const totalBalance = state.wallets.reduce((acc, w) => acc + (w.is_active ? w.balance : 0), 0);
  const totalIncomeMonth = state.transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalExpenseMonth = state.transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalBudgetLimit = state.budgets.reduce((acc, b) => acc + b.monthly_limit, 0);
  const totalBudgetSpent = state.budgets.reduce((acc, b) => acc + b.current_spent, 0);
  const budgetRemaining = Math.max(0, totalBudgetLimit - totalBudgetSpent);

  const recentTransactions = state.transactions.slice(0, 10);

  // Group expenses by category for Pie Chart visualization
  const categoryExpenses: Record<string, { name: string; amount: number; color: string; emoji: string }> = {};
  state.transactions.filter(t => t.type === 'expense').forEach(t => {
    const key = t.category_name || 'Lain-lain';
    if (!categoryExpenses[key]) {
      categoryExpenses[key] = {
        name: key,
        amount: 0,
        color: t.category_id ? (state.categories.find(c => c.id === t.category_id)?.color || '#f97316') : '#f97316',
        emoji: t.category_emoji || '💸',
      };
    }
    categoryExpenses[key].amount += t.amount;
  });

  const categoryList = Object.values(categoryExpenses).sort((a, b) => b.amount - a.amount);

  // 6 Months bar chart dummy data
  const sixMonthsData = [
    { month: 'Mei', income: 7000000, expense: 4200000 },
    { month: 'Jun', income: 7200000, expense: 5100000 },
    { month: 'Jul', income: 7500000, expense: 4800000 },
    { month: 'Ags', income: 8000000, expense: 4500000 },
    { month: 'Sep', income: 8200000, expense: 3900000 },
    { month: 'Okt', income: totalIncomeMonth, expense: totalExpenseMonth },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Top Greeting & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            Selamat Siang, {state.user.full_name} 👋
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Berikut ringkasan kesehatan finansial kamu per hari ini (WIB).
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-300/50 dark:border-zinc-800 text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setPeriod('daily')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === 'daily'
                ? 'bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Harian
          </button>
          <button
            onClick={() => setPeriod('weekly')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === 'weekly'
                ? 'bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Mingguan
          </button>
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === 'monthly'
                ? 'bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Bulanan
          </button>
          <button
            onClick={() => setPeriod('yearly')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === 'yearly'
                ? 'bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Tahunan
          </button>
        </div>
      </div>

      {/* 4 STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Card 1: Saldo Total */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 shadow-sm relative overflow-hidden group hover:border-brand-500/40 transition-all">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <span>Saldo Total</span>
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
            {formatRupiah(totalBalance)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-500">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span className="font-semibold">+12.4%</span>
            <span className="text-zinc-400">vs bulan lalu</span>
          </div>
        </div>

        {/* Card 2: Pemasukan Bulan Ini */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <span>Pemasukan Bulan Ini</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-emerald-500">
            {formatRupiah(totalIncomeMonth)}
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            {state.transactions.filter(t => t.type === 'income').length} transaksi tercatat
          </div>
        </div>

        {/* Card 3: Pengeluaran Bulan Ini */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 shadow-sm relative overflow-hidden group hover:border-orange-500/40 transition-all">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <span>Pengeluaran Bulan Ini</span>
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-orange-500">
            {formatRupiah(totalExpenseMonth)}
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            {state.transactions.filter(t => t.type === 'expense').length} transaksi tercatat
          </div>
        </div>

        {/* Card 4: Budget Tersisa */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <span>Budget Tersisa</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-blue-500">
            {formatRupiah(budgetRemaining)}
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            Terpakai {Math.round((totalBudgetSpent / (totalBudgetLimit || 1)) * 100)}% dari batas
          </div>
        </div>

      </div>

      {/* ONBOARDING CHECKLIST (Part 3 Requirement for new users) */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-brand-500/10 via-amber-500/5 to-transparent border border-brand-500/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="text-brand-500">🚀</span>
              Checklist Akun TataDana Kamu
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Selesaikan 3 langkah mudah ini untuk menikmati pencatatan otomatis 100% tanpa hambatan.
            </p>
          </div>
          <span className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-500/15 px-3 py-1 rounded-full self-start sm:self-auto">
            3 dari 3 Selesai (100%)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-emerald-500/30 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <p className="font-bold text-zinc-900 dark:text-white">1. Hubungkan Telegram</p>
              <p className="text-[11px] text-zinc-400">@budipratama_id terhubung</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-emerald-500/30 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <p className="font-bold text-zinc-900 dark:text-white">2. Set Dompet Default</p>
              <p className="text-[11px] text-zinc-400">BCA Utama aktif</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-emerald-500/30 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <p className="font-bold text-zinc-900 dark:text-white">3. Set Batas Budget</p>
              <p className="text-[11px] text-zinc-400">5 kategori terproteksi</p>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS ROW (Pie Chart & 6 Months Bar Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Pie Chart / Breakdown Pengeluaran per Kategori */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
              Pengeluaran per Kategori
            </h3>
            <span className="text-xs text-zinc-400">Bulan Ini</span>
          </div>

          {/* Visual Bar Distribution */}
          <div className="w-full h-3 rounded-full bg-zinc-100 dark:bg-zinc-850 overflow-hidden flex">
            {categoryList.map((cat, idx) => {
              const pct = (cat.amount / (totalExpenseMonth || 1)) * 100;
              return (
                <div
                  key={idx}
                  style={{ width: `${pct}%`, backgroundColor: cat.color }}
                  title={`${cat.name}: ${formatRupiah(cat.amount)} (${Math.round(pct)}%)`}
                  className="h-full transition-all duration-500"
                />
              );
            })}
          </div>

          {/* Legend Items */}
          <div className="space-y-3 pt-2">
            {categoryList.map((cat, idx) => {
              const pct = Math.round((cat.amount / (totalExpenseMonth || 1)) * 100);
              return (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span 
                      className="w-3 h-3 rounded-md" 
                      style={{ backgroundColor: cat.color }} 
                    />
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {cat.emoji} {cat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-mono">{pct}%</span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {formatRupiah(cat.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6-Month Comparison Bar Chart */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
                Pemasukan vs Pengeluaran 6 Bulan Terakhir
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Analisis tren cashflow dan surplus bulanan</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span>
                Pemasukan
              </span>
              <span className="flex items-center gap-1.5 text-orange-500 font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-orange-500"></span>
                Pengeluaran
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="pt-6 grid grid-cols-6 gap-2 sm:gap-4 items-end h-56 border-b border-zinc-200 dark:border-zinc-800 pb-4">
            {sixMonthsData.map((d, i) => {
              const maxVal = 10000000;
              const incH = Math.round((d.income / maxVal) * 100);
              const expH = Math.round((d.expense / maxVal) * 100);

              return (
                <div key={i} className="flex flex-col items-center gap-2 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1.5 h-44">
                    {/* Income Bar */}
                    <div 
                      style={{ height: `${incH}%` }} 
                      className="w-1/2 bg-emerald-500 rounded-t-lg transition-all duration-500 hover:brightness-110"
                      title={`${d.month}: Pemasukan ${formatRupiah(d.income)}`}
                    />
                    {/* Expense Bar */}
                    <div 
                      style={{ height: `${expH}%` }} 
                      className="w-1/2 bg-orange-500 rounded-t-lg transition-all duration-500 hover:brightness-110"
                      title={`${d.month}: Pengeluaran ${formatRupiah(d.expense)}`}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-zinc-500">{d.month}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
            <span>Rata-rata Surplus: <strong>Rp3.850.000 / bulan</strong></span>
            <span className="text-brand-500 font-semibold">Cashflow Sehat 👍</span>
          </div>
        </div>

      </div>

      {/* 10 RECENT TRANSACTIONS TABLE */}
      <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
              10 Transaksi Terbaru
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Tercatat otomatis dari Telegram Bot dan Web App
            </p>
          </div>
          <Link
            href="/dashboard/reports"
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Lihat Semua Laporan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-semibold">
                <th className="pb-3">Tanggal (WIB)</th>
                <th className="pb-3">Catatan / Merchant</th>
                <th className="pb-3">Kategori</th>
                <th className="pb-3">Dompet</th>
                <th className="pb-3">Sumber</th>
                <th className="pb-3 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850 text-zinc-700 dark:text-zinc-300">
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3.5 text-zinc-400 whitespace-nowrap">
                    {formatWIBDate(tx.transaction_date, 'short')}
                  </td>
                  <td className="py-3.5 font-semibold text-zinc-900 dark:text-white">
                    {tx.note}
                    {tx.items && (
                      <span className="block text-[10px] text-brand-500 font-normal">
                        📸 {tx.items.length} item struk Pro
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-850 font-medium">
                      {tx.category_emoji} {tx.category_name}
                    </span>
                  </td>
                  <td className="py-3.5 text-zinc-400 whitespace-nowrap">
                    {tx.wallet_name}
                  </td>
                  <td className="py-3.5 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      tx.source.includes('telegram')
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}>
                      {tx.source === 'telegram_text' && '💬 Telegram'}
                      {tx.source === 'telegram_voice' && '🎙️ Voice Note'}
                      {tx.source === 'telegram_receipt' && '📸 Struk OCR'}
                      {tx.source === 'web' && '💻 Web App'}
                    </span>
                  </td>
                  <td className={`py-3.5 text-right font-bold whitespace-nowrap ${
                    tx.type === 'income' ? 'text-emerald-500' : 'text-orange-500'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
