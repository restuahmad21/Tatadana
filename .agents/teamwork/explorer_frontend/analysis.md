# Laporan Investigasi Arsitektur Frontend & Komponen UI TataDana

## 1. Executive Summary

Investigasi mendalam terhadap arsitektur frontend TataDana Fintech SaaS telah selesai dilakukan. TataDana memiliki dualitas arsitektur yang sangat terstruktur:
1. **Frontend Desain & Blueprint Next.js 14 App Router** (`src/`): Dibuat menggunakan React 18, TypeScript, Tailwind CSS, Lucide React, dan arsitektur modular App Router.
2. **Server & Single-Page Application (SPA) Produksi Aktif** (`server.js` + `public/index.html`): Server full-stack Node.js native v24 (HTTP/ESM, tanpa dependensi npm eksternal saat runtime) yang melayani SPA interaktif berfitur lengkap dengan Tailwind CSS CDN, Plus Jakarta Sans, dan engine JavaScript ES6. Server ini saat ini berjalan aktif di `http://localhost:3000` dan seluruh rangkaian tes integrasi (69 integration tests di `test_suite.js` dan 74 navigation tests di `test_navigation.js`) dijalankan terhadap server ini.

Laporan ini memetakan seluruh komponen yang ada, alur state management, routing, dan cetak biru integrasi untuk 4 kebutuhan fitur tingkat lanjut:
- **Sistem Approval di Panel Admin** (R1)
- **Form Dompet Baru Terintegrasi Budget Multi-Periode & Proteksi Limit Starter** (R2)
- **Kalender Interaktif Pelacak Riwayat Transaksi & Cashflow Harian** (R3)
- **Modul Integrasi In-App 'Tata AI Bot' Asisten Finansial Interaktif** (R4)

---

## 2. Framework, Build Tool, Component Library & Styling Setup

### 2.1 Next.js 14 App Router Blueprint (`src/`)
- **Framework**: Next.js `14.2.15` (App Router)
- **UI Library**: React `18.3.1`, React DOM `18.3.1`
- **Bahasa**: TypeScript `5.6.3` (`tsconfig.json`)
- **Styling**: Tailwind CSS `3.4.14` (`tailwind.config.ts`, `postcss.config.js`, `src/app/globals.css`)
  - Warna Primer Fintech: Palet `brand` berbasis Jingga / Orange (`brand-500: #f97316`, `brand-600: #ea580c`).
  - Dark Mode: Didukung penuh melalui konfigurasi class `dark` dengan CSS variables di `globals.css`.
  - Font: Plus Jakarta Sans (`var(--font-plus-jakarta)`), Inter, dan sans-serif.
- **Icon Library**: `lucide-react` (`^0.453.0`)
- **Third-party Utilities**: `canvas-confetti`, `jspdf`, `jspdf-autotable`, `xlsx`, `@supabase/supabase-js`, `@supabase/ssr`.
- **Struktur Halaman Next.js**:
  - `src/app/layout.tsx`: Root Layout dengan font Google Fonts preconnect dan metadata.
  - `src/app/page.tsx`: Landing Page lengkap (Hero, feature cards, FAQ accordion, testimonials, pricing switcher).
  - `src/app/dashboard/layout.tsx`: Dashboard Layout dengan sticky header, WIB indicator, dan container `Sidebar.tsx`.
  - `src/app/dashboard/page.tsx`: Dashboard Overview (4 stat cards, donut chart, bar chart 6 bulan, onboarding checklist, 10 transaksi terbaru).
  - `src/app/auth/login/page.tsx` & `src/app/auth/register/page.tsx`: Halaman otentikasi split layout 40/60.
  - `src/components/Sidebar.tsx`: Sidebar navigasi pengguna (Beranda, Transaksi, Laporan, Budget, Wallet, Settings).
  - `src/components/AdminSidebar.tsx`: Sidebar navigasi superadmin.
  - `src/components/TelegramSimulatorModal.tsx`: Simulator dialog Telegram interaktif.

### 2.2 Standalone Production Full-Stack SPA (`server.js` + `public/index.html`)
- **Runtime Server**: Node.js v24 HTTP native, port 3000, zona waktu `Asia/Jakarta (WIB)`.
- **Frontend SPA**: `public/index.html` (3.290 baris kode vanilla HTML/JS/CSS mandiri).
- **Styling**: Tailwind CSS via CDN (`https://cdn.tailwindcss.com`) dengan script extend warna `brand-50` s/d `brand-900`, plus styling custom scrollbar, `orange-glow`, dan transisi dark mode.
- **Keunggulan**: Zero-bundle overhead, dapat berjalan langsung di lingkungan produksi tanpa memerlukan kompilasi `next build` yang berat, dan 100% lulus seluruh audit pengujian.

---

## 3. Struktur Dashboard, Admin Panel, Wallet, Transaksi, dan Budget

### 3.1 Struktur User Dashboard (`#view-dashboard`)
Dashboard mengadopsi pola layout sidebar tetap (lebar 64 / 256px) dan area konten utama yang dapat di-scroll:
- **Header Atas**: Menampilkan badge paket pengguna (`user-plan-badge`), salam waktu (WIB), tombol pintasan "💬 Buka Bot Simulator" (`toggleBotModal()`), dan tombol "+ Tambah Transaksi" (`openAddTxModal()`).
- **Tab Navigasi Dashboard** dikendalikan fungsi `switchDashTab(tabName, push)`:
  1. `dash-overview` (Beranda Keuangan):
     - 4 Kartu KPI: Saldo Total (`#stat-total-balance`), Pemasukan Bulan Ini (`#stat-income`), Pengeluaran Bulan Ini (`#stat-expense`), Sisa Budget Terlindungi (`#stat-budget-left`).
     - Onboarding Checklist: Status 3 langkah awal.
     - Donut Chart SVG Distribusi Pengeluaran per Kategori (`updateOverviewCategoryDonut()`).
     - Bar Chart Perbandingan Arus Kas 6 Bulan Terakhir (Pemasukan vs Pengeluaran).
     - Tabel 10 Transaksi Terbaru (`#overview-tx-rows`).
  2. `dash-transactions` (Daftar & Mutasi Transaksi):
     - Feed mutasi kartu transaksi (`#all-transactions-list`) dengan label sumber (Telegram Teks, Voice Note, Struk AI OCR, Web App), kategori, dompet, nominal (+/-), dan tombol hapus (`deleteTx(id)`).
  3. `dash-reports` (Laporan Keuangan & Ekspor):
     - Filter laporan (pencarian teks, rentang tanggal, jenis pemasukan/pengeluaran, kategori, dompet).
     - Tabel laporan dengan sorting per kolom dan pagination (`prevReportPage()`, `nextReportPage()`).
     - Accordion rincian item struk belanja OCR (`toggleReceiptAccordion()`).
     - Tombol generator ekspor file Excel (.xlsx) dan PDF resmi ber-header WIB.
  4. `dash-budgets` (Batas Budget Kategori):
     - Grid progress bar budget (`#budgets-container`) per kategori dengan persentase pemakaian saldo dan deteksi peringatan 80% & 100%.
  5. `dash-wallets` (Manajemen Multi-Dompet):
     - Grid kartu dompet (`#wallets-container`) dengan saldo terformat rupiah dan tombol "Jadikan Default" untuk integrasi Telegram (`setDefaultWallet(walletId)`).
     - Tombol `+ Tambah Dompet` pada header bar (`openAddWalletModal()`).
  6. `dash-settings` (Pengaturan Akun & Integrasi):
     - Tab Profil Pengguna (Nama, No HP terverifikasi, mata uang).
     - Integrasi Bot Telegram BYOB (Token BotFather, URL Webhook, tombol Test Koneksi).
     - Preferensi Reminder Harian (1x atau 2x sehari pada jam WIB tertentu).
     - Manajemen Kategori Kustom (`addNewCategory()`).

### 3.2 Struktur Admin Panel (`#view-admin`)
Panel admin internal (`id="view-admin"`) bertema dark mode (`bg-zinc-950 text-zinc-100`) dengan navigasi sidebar `AdminSidebar`:
1. **Overview & AI Engine Matrix** (`#ai-providers-grid`):
   - Status, latensi (ms), prioritas failover untuk Google Gemini, OpenAI GPT-4o, dan DeepSeek.
   - Toggle Single vs Parallel Failover mode (`toggleAiMode()`).
2. **Kelola Pengguna & Impersonasi** (`#admin-users-table`):
   - Tabel profil pengguna, plan aktif (Starter/Pro), status integrasi bot, dan tombol 1-klik "Impersonate" (`impersonateUser(userId)`).
3. **Approval Pembayaran Midtrans & Transfer Manual** (`#admin-payments-table`):
   - Verifikasi pesanan upgrade paket, bukti transfer, tombol Approve/Reject (`updatePayment(paymentId, status)`).
4. **Antrean Persetujuan / Approval Queue** (`#approval-queue-section`):
   - Kartu statistik KPI: Total Pengajuan, Menunggu (Pending), Disetujui, Ditolak.
   - Tab filter status (`appr-tab-all`, `appr-tab-pending`, `appr-tab-approved`, `appr-tab-rejected`).
   - Filter dropdown kategori (Upgrade Plan, Top-up Saldo, Limit Budget Khusus).
   - Tabel antrean persetujuan interaktif (`#admin-approvals-table`).
   - Modal konfirmasi tindakan (`#approval-action-modal`) dengan catatan/alasan admin wajib saat penolakan.
   - Modal simulasi pengajuan baru (`#new-approval-modal`).
5. **Log Audit & Akses Data** (`#admin-audit-section`):
   - Tabel audit trail yang mencatat riwayat approval, impersonasi, dan perubahan state (`#admin-audit-logs-table`).

---

## 4. Cetak Biru Integrasi Fitur Baru (Integration Blueprint)

### 4.1 Fitur R1: Admin Approval UI
- **Status di Kode Saat Ini**:
  - Di `public/index.html` dan `server.js`: **Sudah terimplementasi penuh** pada bagian `#approval-queue-section`, `#approval-action-modal`, dan `#new-approval-modal`, serta didukung oleh API backend `GET /api/admin/approvals`, `POST /api/admin/approvals/action`, `POST /api/admin/approvals`. Seluruh 10 pengujian integrasi approval (Test 43-66c) dan verifikasi UI (Test N68-N74) telah berstatus **PASS**.
  - Di `src/` (Next.js): `src/components/AdminSidebar.tsx` telah memiliki tautan navigasi `{ label: 'Approval Pembayaran & Midtrans', href: '/admin/payments', icon: CreditCard }`. Untuk melengkapi keselarasan Next.js, implementer dapat membuat `src/app/admin/page.tsx` atau `src/app/admin/approvals/page.tsx` menggunakan komponen React yang mengonsumsi tipe data `ApprovalRequest` dari `src/lib/types.ts`.

### 4.2 Fitur R2: Form "Dompet Baru" Terintegrasi Budget Multi-Periode
- **Kondisi Eksisting**:
  - Pada `public/index.html` baris 1382, terdapat tombol:
    ```html
    <button onclick="openAddWalletModal()" class="px-3 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-500">
      + Tambah Dompet
    </button>
    ```
    Namun fungsi JavaScript `openAddWalletModal()` dan modal markup-nya belum ada di dalam file `public/index.html`.
  - Di `server.js`, endpoint `POST /api/wallets` sudah ada dan sudah menegakkan batasan 3 dompet untuk Starter:
    ```javascript
    if (db.subscription.plan === 'starter' && db.wallets.length >= 3) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        error: 'Batas maksimal 3 dompet untuk paket Starter tercapai. Upgrade ke Pro untuk dompet unlimited!'
      }));
      return;
    }
    ```
- **Rencana & Titik Integrasi**:
  1. **Modal Form UI (`#add-wallet-modal`)**:
     - Tambahkan elemen modal dialog di `public/index.html` (di dekat `#add-tx-modal` baris 1780) dengan elemen input:
       - Nama Dompet (`#m-wallet-name`): contoh "Bank Mandiri", "SeaBank".
       - Tipe Dompet (`#m-wallet-type`): select option `bank`, `ewallet`, `cash`.
       - Saldo Awal (`#m-wallet-balance`): input numeric format rupiah.
       - Limit Alokasi Budget Terintegrasi (`#m-wallet-budget-limit`): nominal bulanan.
  2. **Multi-Period Auto-Calculation Widget**:
     - Tambahkan kalkulator reaktif pada event input `oninput="updateMultiPeriodDisplay()"`:
       - **Harian (Daily)**: `Limit Bulanan / 30` (misal Rp1.500.000 / 30 = Rp50.000/hari).
       - **Mingguan (Weekly)**: `(Limit Bulanan * 7) / 30` (atau Rp1.500.000 / 4 = Rp375.000/minggu).
       - **Bulanan (Monthly)**: `Limit Bulanan` (Rp1.500.000/bulan).
       - **Visualisasi Persentase Konsumsi**: Bar indicator rasio alokasi budget terhadap saldo awal dompet.
  3. **Peringatan & Proteksi Paket Starter**:
     - Saat `openAddWalletModal()` dipanggil:
       ```javascript
       const isStarter = (appState.subscription.plan === 'starter');
       const walletCount = (appState.wallets || []).length;
       if (isStarter && walletCount >= 3) {
         // Tampilkan banner peringatan Starter Limit Warning di dalam modal
         // Disable tombol submit form dan sediakan CTA "Upgrade ke Pro"
       }
       ```
  4. **Penanganan Submit (`handleCreateWalletSubmit`)**:
     - Kirim payload ke `POST /api/wallets` dengan data nama, tipe, saldo awal, dan budget limit.
     - Simpan data budget baru ke daftar budget (`db.budgets`) jika diisi, refresh `loadState()`, dan tutup modal dengan `showToast('Dompet & alokasi budget berhasil dibuat!')`.

### 4.3 Fitur R3: Kalender Interaktif Pelacak Transaksi Budget
- **Kondisi Eksisting**:
  - Belum ada komponen kalender di `public/index.html` maupun `src/`.
- **Rencana & Titik Integrasi**:
  1. **Penambahan Tab Kalender di Sidebar & Routing**:
     - Tambahkan tombol navigasi pada sidebar `#view-dashboard`:
       ```html
       <button id="nav-calendar" onclick="switchDashTab('calendar')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:text-orange-500">
         📅 <span>Kalender</span>
       </button>
       ```
     - Tambahkan `'calendar'` ke daftar `validTabs` di `server.js` (baris 2037) agar URL `/dashboard/calendar` didukung secara langsung dan tidak me-redirect ke fallback.
  2. **Container Tab Baru (`#dash-calendar`)**:
     - Tempatkan elemen `<div id="dash-calendar" class="dash-tab hidden space-y-6">` di dalam `#view-dashboard`.
  3. **Komponen Kalender Interaktif**:
     - **Header Navigasi Bulan**: Tombol navigasi bulan sebelumnya (`<`) dan bulan berikutnya (`>`), teks bulan & tahun aktif (misal "Oktober 2026").
     - **Grid Kalender (7 Kolom - Sen, Sel, Rab, Kam, Jum, Sab, Min)**:
       - Hitung hari pertama dalam bulan dan jumlah hari.
       - Tiap cell tanggal menampilkan angka hari.
       - **Titik Indikator Transaksi**:
         - Titik hijau jika ada pemasukan pada tanggal tersebut.
         - Titik oranye jika ada pengeluaran pada tanggal tersebut.
         - Badge ringkasan nominal mutasi harian (net cashflow).
       - **Indikator Budget Harian**: Border / status warna hijau jika pengeluaran harian di bawah rata-rata budget harian (`total_monthly_budget / 30`), atau merah jika terjadi overspend di hari itu.
  4. **Interaksi Klik Tanggal & Rekap Cashflow**:
     - Mengklik cell tanggal memicu fungsi `selectCalendarDate(dateStr)`:
       - Panel di samping / bawah kalender menampilkan:
         - **Rekap Cashflow Tanggal Terpilih**: Total Pemasukan Hari Ini, Total Pengeluaran Hari Ini, Net Surplus/Defisit.
         - **Daftar Transaksi Hari Terpilih**: Tabel transaksi yang difilter spesifik hanya untuk tanggal yang diklik.

### 4.4 Fitur R4: Modul Integrasi In-App "Tata AI Bot"
- **Kondisi Eksisting**:
  - Saat ini terdapat modal `#bot-modal` yang merupakan simulator external bot Telegram (`@TataDanaOfficialBot`).
  - Belum ada widget asisten finansial in-app internal "Tata AI" langsung di dashboard web.
- **Rencana & Titik Integrasi**:
  1. **Floating In-App Launcher Button**:
     - Tambahkan floating button di sudut kanan bawah dashboard (sejajar atau di atas simulator Telegram):
       ```html
       <div id="tata-ai-floating-btn" class="fixed bottom-6 right-6 z-40">
         <button onclick="toggleTataAIPanel()" class="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-xs shadow-xl shadow-orange-600/30">
           <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
           <span>✨ Tanya Tata AI</span>
         </button>
       </div>
       ```
  2. **In-App Slide-Out Widget Panel (`#tata-ai-drawer`)**:
     - Panel slide-over atau card floating modal (lebar 400px) bertema fintech premium.
     - Header dengan avatar Tata AI: "Tata AI Assistant • Analisis Finansial & Rekomendasi Pintar".
     - **Quick Prompt Chips (Pintasan Tanya Cepat)**:
       - `💡 "Saran penghematan minggu ini"`
       - `📊 "Analisis kategori boros"`
       - `🎯 "Simulasi tabungan 2 juta"`
       - `📝 "Bantu catat pengeluaran cepat"`
     - Area riwayat pesan interaktif dengan bubble chat user dan bubble chat Tata AI.
  3. **Financial Intelligence Logic & Endpoint**:
     - Di `server.js`, sediakan endpoint `POST /api/ai/chat` atau `POST /api/tata-ai/advisor`:
       - Mengambil data transaksi aktual pengguna, budget, dan saldo saat ini.
       - Menghasilkan saran penghematan berbasis data nyata (misal: "Kategori Makanan sudah terpakai 85% dari batas Rp1.500.000 padahal baru tanggal 12! Kamu disarankan membatasi makan di luar maksimal Rp35.000/hari hingga akhir bulan.").
     - Respons instan berbahasa Indonesia yang bersahabat dan actionable.

---

## 5. State Management, API Client, dan Route Setup

### 5.1 State Management
- **Next.js (`src/lib/store.ts`)**:
  - Menggunakan interface `AppState` terpusat yang menyimpan `user`, `wallets`, `categories`, `budgets`, `transactions`, `subscription`, `reminder`, `aiProviders`, `aiLogs`, `payments`, `auditLogs`, dan `impersonatingUser`.
  - Persistensi menggunakan `localStorage` dengan kunci `tatadana_state_v1`.
  - Sinkronisasi reaktif antar komponen menggunakan custom event `window.dispatchEvent(new Event('tatadana_state_changed'))`.
- **Produksi SPA (`public/index.html`)**:
  - Global variable `let appState = null;`.
  - Fungsi `loadState()` melakukan `fetch('/api/state')` dan menyimpan data ke `appState`.
  - Fungsi `renderAllViews()` merender ulang seluruh komponen secara serempak tanpa re-mount DOM secara penuh.

### 5.2 API Client & Networking
- Native `fetch()` dengan async/await di client-side:
  - `GET /api/state`: Mendapatkan state in-memory database terbaru.
  - `POST /api/wallets`: Menambahkan dompet baru (dengan pengecekan limit Starter).
  - `POST /api/wallets/set-default`: Mengubah dompet default untuk Telegram.
  - `POST /api/transactions`: Mencatat transaksi manual via web.
  - `DELETE /api/transactions/:id`: Menghapus transaksi dan mengembalikan saldo.
  - `POST /api/admin/approvals`: Mengajukan permohonan persetujuan baru.
  - `POST /api/admin/approvals/action`: Menyetujui atau menolak permohonan persetujuan.
  - `POST /api/admin/impersonate`: Beralih identitas user aktif tanpa login ulang.
  - `POST /api/admin/ai-mode`: Mengubah mode AI (Single vs Paralel Failover).
- Notifikasi feedback visual dipusatkan pada `showToast(message, type)`.

### 5.3 Route Setup & Navigation Architecture
- Server Route Mapper (`server.js`):
  - `/` -> Landing page
  - `/login` -> Login page
  - `/register` -> Register page
  - `/dashboard` -> Dashboard utama
  - `/dashboard/:tab` -> Subtab dashboard (`overview`, `transactions`, `reports`, `budgets`, `wallets`, `settings`, dan kelak `calendar`)
  - `/admin` -> Admin portal
- **SSR Pre-activation**: Pada pemanggilan HTTP GET awal, `server.js` melakukan modifikasi HTML string on-the-fly (`modifiedHtml.replace(...)`) untuk membuka view yang diminta (`id="view-${activeView}"`) dan menyelaraskan tag `<title>` halaman.
- **Client-Side SPA Routing**:
  - Fungsi `navigate(viewName, push, tab)` mengubah view yang aktif tanpa full page reload.
  - Menggunakan HTML5 History API: `window.history.pushState(null, '', targetPath)`.
  - Event listener `popstate` untuk menangani tombol Back / Forward di browser pengguna.
  - Normalisasi trailing slash (misal `/dashboard/` tetap membuka dashboard secara mulus).

---

## 6. Matrix Kebutuhan vs Status Implementasi

| Kebutuhan (Requirement) | File Target | Status Saat Ini | Tindakan yang Dibutuhkan |
|---|---|---|---|
| **R1. Admin Approval UI** | `public/index.html`, `server.js`, `src/app/admin/` | ✅ Selesai di `index.html` & `server.js`; Belum di `src/` | Mirroring komponen ke React Next.js jika diperlukan |
| **R2. Dompet Baru & Multi-Periode Budget** | `public/index.html`, `server.js` | ⚠️ Tombol ada, Modal & Multi-periode kalkulator belum ada | Buat `#add-wallet-modal`, live calculator, dan starter warning |
| **R3. Kalender Interaktif Transaksi** | `public/index.html`, `server.js` | ❌ Belum ada | Tambah tab `calendar`, grid 30 hari, dots transaksi & cashflow recap |
| **R4. In-App Tata AI Bot Widget** | `public/index.html`, `server.js` | ❌ Belum ada (hanya simulator Telegram yang ada) | Buat launcher widget, drawer chat, quick prompt chips, endpoint AI |
| **R5. Telegram Bot Enhancements** | `server.js`, `src/lib/telegram-engine.ts` | ⚠️ Parsing dasar selesai, perlu parser multi-kata kompleks | Sesuai pengerjaan tim backend |

---

## 7. Rekomendasi Langkah Implementasi Selanjutnya
1. **Untuk Developer Implementer Frontend**:
   - Buka `public/index.html` dan tambahkan modal `#add-wallet-modal` dengan form input saldo & alokasi budget, widget kalkulator multi-periode (harian, mingguan, bulanan), serta banner peringatan paket Starter.
   - Tambahkan tab `calendar` pada sidebar dan container `#dash-calendar` di `public/index.html`, daftarkan rute di `server.js`, serta pasang logika rendering grid kalender bulanan dan interaksi klik tanggal.
   - Tambahkan floating button launcher `✨ Tanya Tata AI` dan panel chat drawer `#tata-ai-drawer` dengan quick prompts dan generator respons cerdas berbasis riwayat pengeluaran.
2. **Kesesuaian dengan Rangkaian Pengujian**:
   - Pastikan setiap elemen baru tetap kompatibel dengan 74 tes navigasi di `test_navigation.js` dan 69 tes integrasi di `test_suite.js`.
