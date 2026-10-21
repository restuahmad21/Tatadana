/**
 * TataDana Fintech SaaS - Database Admin Account Seeder Script
 *
 * Menambahkan atau menginisialisasi akun Administrator 'Restu Ahmad Hidayat'
 * secara permanen ke dalam basis data TataDana.
 *
 * Kredensial:
 * - Nama Lengkap  : Restu Ahmad Hidayat
 * - Nomor WhatsApp: 083194703373
 * - Email         : restu@tatadana.id
 * - Password      : Restu21!
 * - Role          : admin (Superadmin)
 * - Status        : approved (Bypass approval otomatis)
 *
 * Penggunaan:
 *   node scripts/seed-admin.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const ADMIN_ACCOUNT = {
  id: 'usr_admin_restu',
  full_name: 'Restu Ahmad Hidayat',
  phone_number: '083194703373',
  email: 'restu@tatadana.id',
  password: 'Restu21!',
  role: 'admin',
  approval_status: 'approved',
  is_approved: true,
  whatsapp_verified: true,
  phone_verified: true,
  plan: 'pro',
  telegram_connected: true,
  telegram_username: '@restuahmad_admin',
  custom_bot_token: null,
  total_transactions: 0,
  job_profile: 'Administrator & System Architect',
  joined_at: '2026-10-17'
};

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'admin-users.json');

function seedFileStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let adminList = [];
  if (fs.existsSync(DATA_FILE)) {
    try {
      adminList = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (!Array.isArray(adminList)) adminList = [];
    } catch (e) {
      adminList = [];
    }
  }

  const existingIdx = adminList.findIndex(
    u => u.phone_number === ADMIN_ACCOUNT.phone_number || u.id === ADMIN_ACCOUNT.id
  );

  if (existingIdx >= 0) {
    adminList[existingIdx] = { ...adminList[existingIdx], ...ADMIN_ACCOUNT };
  } else {
    adminList.unshift(ADMIN_ACCOUNT);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(adminList, null, 2), 'utf8');
  console.log(`📁 File persistensi data tersimpan: ${DATA_FILE}`);
}

function verifyLiveServer() {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      identifier: ADMIN_ACCOUNT.phone_number,
      password: ADMIN_ACCOUNT.password,
      rolePortal: 'admin',
      method: 'Seeder Verification'
    });

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            resolve({ online: true, status: res.statusCode, data: json });
          } catch (e) {
            resolve({ online: true, status: res.statusCode, raw: body });
          }
        });
      }
    );

    req.on('error', () => {
      resolve({ online: false });
    });

    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('\n======================================================');
  console.log('🚀 INISIALISASI & SEEDER AKUN ADMIN TATADANA');
  console.log('======================================================\n');

  // 1. Simpan ke berkas penyimpanan permanen
  seedFileStorage();

  console.log('\n📋 DETAIL AKUN ADMINISTRATOR:');
  console.log('------------------------------------------------------');
  console.log(`• Nama Lengkap    : ${ADMIN_ACCOUNT.full_name}`);
  console.log(`• Nomor Handphone : ${ADMIN_ACCOUNT.phone_number} (✓ Terverifikasi)`);
  console.log(`• Email           : ${ADMIN_ACCOUNT.email}`);
  console.log(`• Password        : ${ADMIN_ACCOUNT.password}`);
  console.log(`• Role Hak Akses  : ${ADMIN_ACCOUNT.role.toUpperCase()} (Bypass Approval)`);
  console.log(`• Status Approval : ${ADMIN_ACCOUNT.approval_status.toUpperCase()} (Langsung Aktif)`);
  console.log(`• Paket Layanan   : ${ADMIN_ACCOUNT.plan.toUpperCase()}`);
  console.log('------------------------------------------------------\n');

  // 2. Verifikasi terhadap live server jika aktif
  const liveCheck = await verifyLiveServer();
  if (liveCheck.online) {
    if (liveCheck.data && liveCheck.data.ok) {
      console.log('🟢 SERVER AKTIF (Port 3000): Login verifikasi BERHASIL!');
      console.log(`   User ID     : ${liveCheck.data.user.id}`);
      console.log(`   Role        : ${liveCheck.data.user.role}`);
      console.log(`   Status      : ${liveCheck.data.user.approval_status}`);
      console.log(`   Redirect    : ${liveCheck.data.redirect}`);
    } else {
      console.log('🟡 SERVER AKTIF: Menunggu restart server agar memuat data seeder baru.');
    }
  } else {
    console.log('ℹ️ Server backend sedang offline. Data telah tersimpan permanen dan akan dimuat otomatis saat server dijalankan.');
  }

  console.log('\n✅ PROSES SEEDER SELESAI!');
  console.log('======================================================\n');
}

run();
