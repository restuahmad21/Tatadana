# TataDana

Aplikasi manajemen keuangan pribadi: catat transaksi dari dashboard atau Telegram, pantau wallet dan budget, lalu lihat laporan dalam zona waktu WIB.

## Menjalankan lokal

Prasyarat: Node.js 22.13 atau lebih baru. Tidak perlu memasang server database; SQLite dan file `data/tatadana.sqlite` dibuat otomatis.

```powershell
Copy-Item .env.example .env
```

Seeder membaca `ADMIN_EMAIL` dan `ADMIN_PASSWORD` saat startup; jika tidak diatur, default admin adalah `restu@tatadana.id` dengan password `restu21!`. Password disimpan sebagai hash bcrypt dan akun yang cocok dipastikan ber-role admin serta disetujui. Login admin tersedia di `/admin/login`; login pengguna tersedia di `/login`.

```powershell
npm.cmd install
npm.cmd start
```

Buka `http://localhost:3000`. Startup menerapkan migrasi dan seeder secara idempoten. Wallet default Tunai bernilai Rp0; tidak ada transaksi dummy.

## Fitur aplikasi

- Dashboard saldo semua wallet, cashflow enam bulan, transaksi terakhir, serta progress budget.
- Transaksi pemasukan, pengeluaran, dan transfer antar-wallet.
- Laporan dengan filter tanggal, jenis, kategori, wallet, pencarian, pagination, dan ekspor CSV.
- Settings profil, wallet, kategori, budget bulanan, dan pengingat WIB.
- Paket Starter Rp49.000/bulan dan Pro Rp99.000 sekali bayar; approval manual tersedia untuk localhost.
- Panel `/admin` untuk direktori pengguna, approval pembayaran, konfigurasi Gemini, dan log.

## Telegram

Di Pengaturan, tempel token dari BotFather. TataDana memanggil `getMe`, menyimpan token terenkripsi, lalu menampilkan kode pairing. Kirim `/start KODE` ke bot. Di localhost, long polling otomatis digunakan; tidak perlu webhook atau ngrok.

Commands: `/saldo`, `/hari_ini`, `/minggu_ini`, `/bulan_ini`, `/budget`, `/bantuan`. Catatan teks menerima nominal Indonesia seperti `beli bakso 15rb` atau `gajian 5jt`. Foto/voice tersedia untuk akun Pro saat Gemini dikonfigurasi. Update Telegram dideduplikasi.

Webhook opsional memerlukan HTTPS publik. Jalankan tunnel, misalnya `ngrok http 3000`, isi `PUBLIC_BASE_URL` dengan alamat HTTPS yang diberikan ngrok, restart server, lalu aktifkan webhook di Settings. Beralih kembali ke polling dari Settings untuk localhost.

## AI dan pembayaran

Gemini merupakan provider AI utama. Key dapat berasal dari `GEMINI_API_KEY` atau diuji/disimpan terenkripsi oleh admin. Tanpa key, parsing teks memakai fallback lokal; media memerlukan Gemini. Ganti provider dengan mengimplementasikan adapter sejenis di `src/providers/ai/`.

Pembayaran berjalan manual tanpa konfigurasi eksternal. Untuk checkout Midtrans, isi `MIDTRANS_SERVER_KEY`; sandbox digunakan kecuali `MIDTRANS_IS_PRODUCTION=true`. Notifikasi pembayaran diverifikasi signature SHA-512.

`SESSION_SECRET` dan `APP_ENCRYPTION_KEY` opsional di localhost. Bila kosong, rahasia acak lokal disimpan di `data/`; file database dan kunci tersebut diabaikan Git. Untuk deployment, pasok keduanya melalui secret manager dan gunakan HTTPS.

## Rute

`/` landing publik, `/login`, `/admin/login`, dan `/register` publik. Registrasi baru berstatus menunggu konfirmasi admin di `/approval`; `/dashboard`, `/reports`, `/settings`, `/plans`, dan `/admin` terproteksi sesuai role. Webhook Telegram dan Midtrans menerima secret/signature provider, bukan sesi browser.
