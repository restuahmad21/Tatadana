## 2026-10-12T07:02:15Z
You are Specialist Worker 3 for TataDana Fintech SaaS, assigned to Milestone 3: Kalender Interaktif Pelacak Riwayat Transaksi Budget (R3).
Your working directory is: C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana\.agents\teamwork\worker_m3_calendar
The project root is: C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana
PROJECT.md path: C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana\.agents\teamwork\orchestrator\PROJECT.md
MANDATORY: You MUST read C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Acceptance Criteria for R3:
- Grid kalender bulanan interaktif menampilkan titik indikator transaksi pada tiap tanggal yang memiliki mutasi.
- Mengklik tanggal tertentu memfilter daftar transaksi hanya untuk tanggal tersebut dan menampilkan rekap cashflow harian (total pemasukan, total pengeluaran, net cashflow).
- Terdapat navigasi bulan (Bulan Sebelumnya / Bulan Berikutnya).
- Dashboard memiliki menu navigasi #nav-calendar dan container #dash-calendar, serta rute /dashboard/calendar di server.js (validTabs).
Files owned exclusively:
- public/modules/calendar.js (and integrate into public/index.html navigation and #dash-calendar).
- Registering 'calendar' in server.js validTabs.
Tasks:
1. Add calendar navigation button #nav-calendar to the sidebar and #dash-calendar section in public/index.html.
2. Add 'calendar' to validTabs in server.js.
3. Implement interactive monthly grid calendar with day cells, month navigation (prev/next), and mutation indicator dots on days with transactions.
4. Implement date click handler: clicking any date displays the filtered transactions for that date and daily cashflow summary (income, expense, net).
5. Run tests (node test_navigation.js and node test_suite.js) and add automated test assertions for calendar view and navigation.
6. Write full report to handoff.md. Send a message when finished.
