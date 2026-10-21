'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Cpu, 
  FileText, 
  CreditCard, 
  ShieldCheck, 
  ExternalLink,
  ChevronLeft
} from 'lucide-react';

export default function AdminSidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Ringkasan Superadmin', href: '/admin', icon: LayoutDashboard },
    { label: 'Kelola Pengguna & Impersonasi', href: '/admin/users', icon: Users },
    { label: 'Multi-AI Provider Engine', href: '/admin/ai-providers', icon: Cpu },
    { label: 'Riwayat Log Pemanggilan AI', href: '/admin/ai-logs', icon: FileText },
    { label: 'Approval Pembayaran & Midtrans', href: '/admin/payments', icon: CreditCard },
    { label: 'Audit Trail & Akses Data', href: '/admin/audit-logs', icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 h-screen flex flex-col fixed inset-y-0 left-0 z-40 bg-zinc-950 text-zinc-100 border-r border-zinc-800 p-4">
      {/* Header */}
      <div className="pb-6 border-b border-zinc-850">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-brand-500 flex items-center justify-center font-black text-white shadow-md">
            🛡️
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base text-white tracking-tight">Superadmin</span>
              <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.2 rounded border border-red-500/30">
                ROOT
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">TataDana Internal Console</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-red-500/15 text-red-400 font-semibold border border-red-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-red-400' : 'text-zinc-500'}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Switch back to User View */}
      <div className="pt-4 border-t border-zinc-850 space-y-2">
        <Link
          href="/dashboard"
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-semibold text-zinc-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ChevronLeft className="w-4 h-4 text-brand-500" />
            <span>Kembali ke App User</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
        </Link>
      </div>
    </aside>
  );
}
