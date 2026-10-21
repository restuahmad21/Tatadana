# Original User Request

## 2026-10-12T06:43:26Z

Pengembangan fitur tingkat lanjut untuk TataDana Fintech SaaS: sistem approval admin, fitur pembuatan dompet baru terintegrasi budget multi-periode (harian, mingguan, bulanan), kalender interaktif pelacak transaksi budget, modul integrasi in-app "Tata AI bot", dan perbaikan logika Telegram bot.

Requested team: buat dengan 5 agen sekaligus
Working directory: C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana
Integrity mode: development

## Requirements

### R1. Sistem Approval (Persetujuan) di Panel Admin
Admin dapat menyetujui atau menolak aksi pengguna (upgrade paket Pro manual, penyesuaian/top-up saldo dompet, ekspansi limit budget) secara interaktif dengan catatan/alasan penolakan, proteksi state machine (mencegah double-spending), dan pencatatan riwayat audit trail otomatis.

### R2. Fitur "Dompet Baru" Terintegrasi Budget Multi-Periode
Pengguna dapat membuat dompet baru langsung dari dashboard dengan alokasi budget terintegrasi yang terhitung otomatis dalam periode harian, mingguan, dan bulanan dengan visualisasi persentase konsumsi saldo.

### R3. Kalender Interaktif Pelacak Riwayat Transaksi Budget
Tampilan kalender interaktif di dashboard yang memetakan transaksi pengeluaran dan pemasukan berdasarkan tanggal, menampilkan indikator status budget per hari, dan ringkasan cashflow pada tanggal yang dipilih.

### R4. Modul Integrasi In-App "Tata AI Bot"
Modul asisten finansial interaktif "Tata AI" langsung di dalam dashboard web (bukan hanya Telegram) yang dapat diajak berdiskusi tentang analisis pengeluaran, rekomendasi penghematan, dan simulasi pencatatan transaksi cerdas.

### R5. Deteksi Masalah & Perbaikan Logika Bot Telegram
Peningkatan akurasi pemrosesan natural language pada bot Telegram: penanganan input multi-kata nominal kompleks, pencegahan silent failure, toleransi variasi format angka Indonesia, dan ketahanan sinkronisasi webhook.

## Acceptance Criteria

### Admin Approval System
- [ ] Admin dapat melihat daftar antrean approval dengan filter status (Pending, Approved, Rejected).
- [ ] Menyetujui aksi pengguna langsung memperbarui data akun/saldo/budget terkait dan tercatat di audit log.
- [ ] Menolak aksi pengguna mewajibkan input alasan penolakan dan tidak mengubah saldo/paket user.
- [ ] Re-approval pada permohonan yang sudah diproses ditolak dengan error 400.

### Dompet Baru & Budget Multi-Periode
- [ ] Form pembuatan dompet baru tersedia di dashboard pengguna dengan input nama, tipe, saldo awal, dan limit budget.
- [ ] Sistem menghitung dan menampilkan utilisasi budget dalam 3 skala waktu: harian, mingguan, dan bulanan secara otomatis.
- [ ] Batasan paket Starter (maksimal 3 dompet) tetap ditegakkan dengan pesan upgrade jika terlampaui.

### Kalender Interaktif
- [ ] Grid kalender bulanan interaktif menampilkan titik indikator transaksi pada tiap tanggal yang memiliki mutasi.
- [ ] Mengklik tanggal tertentu memfilter daftar transaksi hanya untuk tanggal tersebut dan menampilkan rekap cashflow harian.
- [ ] Terdapat navigasi bulan (Bulan Sebelumnya / Bulan Berikutnya).

### Modul Tata AI Bot
- [ ] Panel/widget chat "Tata AI" tersedia di dashboard web dengan respons instan berbahasa Indonesia.
- [ ] Mampu memberikan saran penghematan cerdas berdasarkan riwayat transaksi aktual pengguna.

### Perbaikan Bot Telegram
- [ ] Parser nominal mengenali format kompleks tanpa kegagalan (misal: "makan 25.500", "gaji 12,5jt", "beli pulsa 50rb").
- [ ] Webhook memproses pesan dengan respons cepat dan idempotensi tanpa duplikasi transaksi.


## 2026-10-17T02:54:43Z

Penambahan fitur filter periode waktu (Harian, Mingguan, Bulanan) pada bagian "Batas Budget per Kategori" di Beranda Keuangan dan subtab Budget TataDana, dilengkapi kontrol antarmuka tabs interaktif dan kalkulasi dinamis untuk nominal pengeluaran berjalan, batas budget maksimal, dan persentase progress bar.

Requested team: kerjakan dengan 5 agent sekaligus
Working directory: C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana
Integrity mode: development

## Requirements

### R1. Komponen Antarmuka Selektor Periode Waktu
Menyediakan antarmuka selektor periode berupa tombol Tabs interaktif (Harian, Mingguan, Bulanan) di bagian atas daftar "Batas Budget per Kategori" pada subtab Budget dan Beranda Keuangan, dengan status visual tab aktif yang jelas (highlight orange modern fintech).

### R2. Kalkulasi Dinamis Pengeluaran Berjalan & Limit Budget per Kategori
Memperbarui logika kalkulasi agar saat periode waktu dipilih:
- **Harian**: Batas budget dihitung dari `Math.round(monthly_limit / 30)`, dan nominal pengeluaran dihitung dari transaksi pengeluaran kategori terkait pada hari ini.
- **Mingguan**: Batas budget dihitung dari `Math.round(monthly_limit / 4)`, dan nominal pengeluaran dihitung dari transaksi pengeluaran kategori terkait dalam 7 hari terakhir / minggu berjalan.
- **Bulanan**: Batas budget menggunakan `monthly_limit`, dan nominal pengeluaran mencakup seluruh pengeluaran bulan berjalan.

### R3. Visualisasi Progress Bar & Indikator Alert Multi-Periode
Setiap kartu budget kategori secara otomatis memperbarui:
- Persentase pemakaian budget: `(pengeluaran_periode / limit_periode) * 100%`.
- Lebar progress bar visual sesuai persentase yang dihitung.
- Tampilan teks kuota: `Rp[pengeluaran] / Rp[limit] ([persentase]%)`.
- Indikator peringatan (badge/alert): muncul jika pemakaian mencapai atau melampaui 80% dan 100% pada periode yang aktif dipilih.

### R4. Integrasi State Reaktif & Ketahanan Test Suite
Perubahan filter periode harus bekerja secara instan tanpa perlu reload halaman, tersinkronisasi saat ada mutasi transaksi baru (dari Web maupun Telegram Bot), dan mempertahankan kompatibilitas penuh dengan seluruh test suite yang ada.

## Acceptance Criteria

### Komponen UI Tabs Periode
- [ ] Tersedia tombol filter periode waktu bertipe Tabs (Harian, Mingguan, Bulanan) di atas daftar Batas Budget per Kategori.
- [ ] Tab yang aktif memiliki penanda visual (warna orange dengan kontras tinggi) dan dapat diklik untuk berganti periode seketika.

### Logika Kalkulasi & Nilai Nominal
- [ ] Memilih tab "Harian" menampilkan limit `monthly_limit / 30` dan hanya menjumlahkan pengeluaran kategori hari ini.
- [ ] Memilih tab "Mingguan" menampilkan limit `monthly_limit / 4` dan menjumlahkan pengeluaran kategori 7 hari terakhir.
- [ ] Memilih tab "Bulanan" menampilkan `monthly_limit` penuh dan pengeluaran bulan berjalan.
- [ ] Kalkulasi persentase dan sisa kuota budget terhitung secara matematis presisi tanpa nilai NaN atau pembagian dengan nol.

### Visual Progress Bar & Alert
- [ ] Lebar progress bar menyesuaikan secara proporsional (0% s/d 100%) dengan transisi yang mulus.
- [ ] Pesan peringatan kuota (>= 80% atau >= 100%) muncul secara dinamis sesuai kondisi periode yang sedang aktif.

### Stabilitas Sistem
- [ ] Penambahan transaksi baru otomatis memperbarui angka pada periode yang sedang aktif.
- [ ] Seluruh test suite eksisting (`test_suite.js`, `test_telegram_polling.js`, `test_navigation.js`, dll.) tetap 100% lulus.
