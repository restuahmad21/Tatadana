'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import TelegramSimulatorModal from '@/components/TelegramSimulatorModal';
import { getInitialState, AppState } from '@/lib/store';
import { Bot, Bell, Plus, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AppState | null>(null);
  const [botModalOpen, setBotModalOpen] = useState(false);

  useEffect(() => {
    setState(getInitialState());

    const handleSync = () => {
      setState(getInitialState());
    };

    window.addEventListener('tatadana_state_changed', handleSync);
    return () => window.removeEventListener('tatadana_state_changed', handleSync);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex transition-colors">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        userFullName={state?.user?.full_name}
        userPhone={state?.user?.phone_number}
        plan={state?.subscription?.plan}
        onOpenBotSimulator={() => setBotModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-850 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              WIB (Asia/Jakarta)
            </span>
            <span className="hidden sm:inline text-xs text-zinc-400">
              • Sinkronisasi Supabase Realtime Aktif
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Simulator Trigger */}
            <button
              onClick={() => setBotModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 text-white font-semibold text-xs shadow-md shadow-brand-500/20 hover:scale-102 active:scale-98 transition-all"
            >
              <Bot className="w-4 h-4" />
              <span>Simulasi Chat Bot</span>
            </button>

            {/* Quick Record Link */}
            <Link
              href="/dashboard/transactions"
              className="p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-colors"
              title="Catat Transaksi Manual"
            >
              <Plus className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>

      </div>

      {/* Floating Telegram Simulator Modal */}
      <TelegramSimulatorModal
        isOpen={botModalOpen}
        onClose={() => setBotModalOpen(false)}
        onStateUpdated={(newState) => setState(newState)}
      />

    </div>
  );
}
