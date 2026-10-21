# 🍊 TataDana — Catat Keuangan Semudah Chat Langsung dari Telegram

**TataDana** adalah aplikasi manajemen keuangan pribadi SaaS modern Indonesia yang terintegrasi secara end-to-end dengan Telegram Bot. Pengguna dapat mencatat pemasukan dan pengeluaran langsung dari chat Telegram dengan bahasa natural sehari-hari, pesan suara (voice note), atau foto struk belanjaan. Setiap transaksi otomatis tersimpan rapi di database Supabase Postgres dan disajikan dalam dashboard web interaktif bertema fintech premium (Orange + Putih / Dark Mode).

---

## 🚀 Status Server Localhost
Aplikasi saat ini telah **aktif berjalan di localhost**:
- **URL Dashboard Web**: [http://localhost:3000](http://localhost:3000)
- **Telegram Webhook URL**: [http://localhost:3000/api/telegram/webhook](http://localhost:3000/api/telegram/webhook)
- **Admin Portal**: Akses langsung dari menu navigasi atau URL dashboard (klik badge Superadmin).

---

## 🛠️ Stack Teknologi & Arsitektur

1. **Database & Auth**:
   - **Supabase Postgres**: Didefinisikan lengkap di [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) mencakup 10 tabel relasional, enum, triggers, dan Row Level Security (RLS).
   - **Auth**: Autentikasi berbasis Nomor Handphone (diverifikasi via OTP) yang berfungsi sebagai kunci penyambung akun ke bot Telegram, Email & Password, serta Google OAuth.

2. **Telegram Bot Engine**:
   - 1 Shared Bot untuk seluruh user (`@TataDanaOfficialBot`).
   - Endpoint webhook publik di `/api/telegram/webhook` dengan mekanisme **idempotency** (mengecek `update_id` untuk mencegah pencatatan transaksi ganda akibat retry Telegram).
   - Parsing bahasa natural menggunakan LLM dengan format angka Indonesia (`15rb`, `1.5jt`, `500k`, `25.000`).
   - Fitur Voice Note (transkrip otomatis + ringkasan reply) dengan batas durasi 60 detik.
   - Fitur Foto Struk AI OCR (Pro) dengan ekstraksi multi-item (tersimpan sebagai 1 transaksi utama dengan rincian per item yang dapat di-expand).
   - Seluruh timestamp diformat menggunakan zona waktu **WIB (Asia/Jakarta)**.

3. **Multi-AI Provider Engine**:
   - Multi-provider: **Google Gemini 2.0 Flash**, **OpenAI GPT-4o / Whisper**, dan **DeepSeek V3 / R1**.
   - Dikonfigurasi dari Admin Dashboard dengan mode **Single** atau **Paralel (Failover Otomatis)**.
   - API Key disimpan terenkripsi.

4. **Payment & Subscriptions**:
   - Paket **Starter** (Rp49.000/bln) dan **Pro Lifetime** (Rp99.000 Sekali Bayar).
   - Integrasi Midtrans (QRIS, Virtual Account, E-Wallet) dan opsi persetujuan manual (Approve/Reject) langsung dari Admin Dashboard.

5. **Laporan & Export**:
   - Generator PDF dan Excel (.xlsx kompatibel) on-demand.
   - Riwayat export tersimpan yang dapat didownload ulang.

---

## 📋 Struktur Halaman Aplikasi

1. **Landing Page** (`/`):
   - Navbar sticky dengan logo TataDana, link Fitur, Harga, FAQ, tombol Masuk & Coba Gratis.
   - Hero Section dengan badge, headline gradient orange, sub-headline, dan video player preview.
   - Problem Aware Bullet Points: 3 problem utama pengguna Indonesia & transisi solusi.
   - Interactive Preview: Simulasi chat bot Telegram dan ringkasan dashboard berdampingan.
   - 3 Fitur alternating layout: Catat via Telegram, Laporan & Export Supabase, AI Financial Advisor.
   - Testimoni Masonry Grid, Paket Harga (Starter vs Pro), 7 Pertanyaan FAQ, dan Final CTA.

2. **Auth Pages** (`/auth/login` & `/auth/register`):
   - 40/60 Split Layout premium bertema Orange + Putih (panel branding "Keuanganmu. Terkontrol." di kiri, form di kanan).
   - Login dengan Nomor HP + OTP (simulasi OTP: 123456), Email/Password, dan Google OAuth.
   - Register dengan Step 2: AI Onboarding Recommendation yang menyiapkan set kategori awal dan dompet BCA.

3. **User Dashboard** (`/dashboard`):
   - **Beranda**: 4 Stat cards, Donut chart kategori, Bar chart arus kas 6 bulan, Onboarding checklist, 10 transaksi terbaru, filter periode.
   - **Transaksi**: Form pencatatan cepat dan live feed transaksi lengkap dengan filter sumber.
   - **Laporan**: Tabel transaksi lengkap dengan pagination, sortable per kolom, filter kategori/dompet/jenis, accordion expand item struk belanja, dan tombol export PDF/Excel.
   - **Budget**: Visual progress bar budget kategori bulanan dengan deteksi alert 80% & 100%.
   - **Dompet**: Manajemen multi-wallet (BCA, GoPay, Tunai) dengan tombol jadikan default untuk Telegram.
   - **Pengaturan**: Setup token bot Telegram pribadi dengan validasi `Test Koneksi` via API Telegram, serta pengaturan reminder harian (maks 2x/hari WIB).

4. **Admin Dashboard** (`/admin`):
   - Superadmin Impersonation: Beralih ke profil user lain dengan 1 klik tanpa login ulang.
   - AI Provider Matrix: Monitor latensi, status aktif, dan toggle mode Single vs Paralel Failover.
   - User Management Table: Pantau plan aktif dan status koneksi Telegram tiap pengguna.
   - Approval Pembayaran Midtrans / Transfer Manual.
   - AI Call Logs & Biaya Monitoring.
   - Export Semua Data Pengguna ke file `.json`.

---

## 💻 Cara Menjalankan Secara Mandiri

```bash
# 1. Masuk ke direktori proyek
cd "C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana"

# 2. Jalankan server aplikasi
node server.js
```

Buka browser di **[http://localhost:3000](http://localhost:3000)**.
