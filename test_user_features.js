/**
 * Test Suite: TataDana Real User Features Verification
 * 1. Edit Profile & Permanent Photo Upload (Persistence to database & disk)
 * 2. Calendar Notes CRUD (Add, Read, Update, Delete with database persistence)
 * 3. Transaction PDF Export (Server-backed & format validation)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: buffer.toString('utf-8'),
          raw: buffer
        });
      });
    });
    req.on('error', reject);
    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

let passCount = 0;
let failCount = 0;

function assert(cond, message) {
  if (cond) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING TEST SUITE: USER FEATURES (REAL BACKEND)');
  console.log('====================================================\n');

  // Auto-start server if not already running
  try {
    await request({ hostname: 'localhost', port: 3000, path: '/api/state', method: 'GET' });
  } catch (e) {
    require('./server.js');
    await new Promise(r => setTimeout(r, 600));
  }

  // ----------------------------------------------------
  // TEST GROUP 1: Edit Profil & Backend Persistence
  // ----------------------------------------------------
  console.log('▶ Test Group 1: Edit Profil & Backend Persistence');
  const updateProfilePayload = {
    full_name: 'Budi Pratama',
    email: 'budi.pratama@tatadana.id',
    phone_number: '081234567890',
    job_title: 'Lead Software Architect',
    bio: 'Menabung untuk kemandirian finansial dan dana pensiun dini.',
    default_currency: 'IDR'
  };

  const profRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/user/profile',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, updateProfilePayload);

  assert(profRes.statusCode === 200, `POST /api/user/profile returns 200 (Got ${profRes.statusCode})`);
  const profData = JSON.parse(profRes.body);
  assert(profData.ok === true, 'Response indicates success (ok === true)');
  assert(profData.user.full_name === 'Budi Pratama', `Profile name updated: ${profData.user.full_name}`);
  assert(profData.user.email === 'budi.pratama@tatadana.id', `Profile email updated: ${profData.user.email}`);
  assert(profData.user.job_title === 'Lead Software Architect', `Profile job title updated: ${profData.user.job_title}`);

  // Check persistence in data/user-profiles.json
  const profileFilePath = path.join(__dirname, 'data', 'user-profiles.json');
  assert(fs.existsSync(profileFilePath), 'data/user-profiles.json exists on disk');
  const rawProfiles = JSON.parse(fs.readFileSync(profileFilePath, 'utf8'));
  const profileList = Array.isArray(rawProfiles) ? rawProfiles : Object.values(rawProfiles);
  const foundUser = profileList.find(u => u.phone_number === '081234567890' || u.full_name === 'Budi Pratama');
  assert(foundUser && (foundUser.job_title === 'Lead Software Architect' || foundUser.job_profile === 'Lead Software Architect'), 'User profile persisted to data/user-profiles.json');

  // ----------------------------------------------------
  // TEST GROUP 2: Upload Foto Profil Permanen
  // ----------------------------------------------------
  console.log('\n▶ Test Group 2: Upload Foto Profil Permanen');
  // Small 1x1 transparent PNG in base64
  const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  const uploadRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/user/upload-avatar',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    avatar_data: samplePngBase64,
    filename: 'test_avatar.png'
  });

  assert(uploadRes.statusCode === 200, `POST /api/user/upload-avatar returns 200 (Got ${uploadRes.statusCode})`);
  const uploadData = JSON.parse(uploadRes.body);
  assert(uploadData.ok === true, 'Avatar upload indicates success (ok === true)');
  assert(typeof uploadData.avatar_url === 'string' && uploadData.avatar_url.startsWith('/uploads/avatars/'), `Avatar URL generated: ${uploadData.avatar_url}`);

  // Verify file was written to disk in public/uploads/avatars
  const avatarFileName = path.basename(uploadData.avatar_url);
  const diskAvatarPath = path.join(__dirname, 'public', 'uploads', 'avatars', avatarFileName);
  assert(fs.existsSync(diskAvatarPath), `Avatar file exists on disk at ${diskAvatarPath}`);

  // Test downloading the avatar via HTTP GET
  const getAvatarRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: uploadData.avatar_url,
    method: 'GET'
  });
  assert(getAvatarRes.statusCode === 200, `GET ${uploadData.avatar_url} returns 200 OK`);
  assert(getAvatarRes.headers['content-type'].includes('image'), `Content-Type is image/* (${getAvatarRes.headers['content-type']})`);

  // ----------------------------------------------------
  // TEST GROUP 3: Kalender Notes CRUD Asli & Database Persistence
  // ----------------------------------------------------
  console.log('\n▶ Test Group 3: Kalender Notes CRUD & Database Persistence');

  // 3a. Read existing notes
  const getNotesRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/calendar/notes',
    method: 'GET'
  });
  assert(getNotesRes.statusCode === 200, 'GET /api/calendar/notes returns 200 OK');
  const initialNotesData = JSON.parse(getNotesRes.body);
  assert(Array.isArray(initialNotesData.notes), 'Response contains array of notes');

  // 3b. Create new note
  const newNotePayload = {
    date: '2026-10-25',
    title: 'Bayar Asuransi Kesehatan Keluarga',
    content: 'Jatuh tempo pembayaran premi BPJS & Prudential untuk 3 anggota keluarga.',
    tag: 'Tagihan',
    priority: 'high'
  };

  const createNoteRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/calendar/notes',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, newNotePayload);

  assert(createNoteRes.statusCode === 201, `POST /api/calendar/notes returns 201 Created (Got ${createNoteRes.statusCode})`);
  const createdNoteData = JSON.parse(createNoteRes.body);
  assert(createdNoteData.ok === true, 'Note creation ok === true');
  const createdId = createdNoteData.note.id;
  assert(Boolean(createdId), `Note created with ID: ${createdId}`);
  assert(createdNoteData.note.title === 'Bayar Asuransi Kesehatan Keluarga', 'Note title matches input');

  // Check persistence in data/calendar-notes.json
  const notesFilePath = path.join(__dirname, 'data', 'calendar-notes.json');
  assert(fs.existsSync(notesFilePath), 'data/calendar-notes.json exists on disk');
  const savedNotesAfterCreate = JSON.parse(fs.readFileSync(notesFilePath, 'utf8'));
  const foundSavedNote = savedNotesAfterCreate.find(n => n.id === createdId);
  assert(Boolean(foundSavedNote), 'New note is physically persisted in data/calendar-notes.json');

  // 3c. Update the note
  const updateNotePayload = {
    id: createdId,
    title: 'Bayar Asuransi Kesehatan Keluarga (SELESAI DITRANSFER)',
    content: 'Sudah dibayar via mobile banking BCA sebesar Rp850.000.',
    tag: 'Tagihan',
    priority: 'medium'
  };

  const updateNoteRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/calendar/notes',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, updateNotePayload);

  assert(updateNoteRes.statusCode === 200, `PUT /api/calendar/notes returns 200 OK (Got ${updateNoteRes.statusCode})`);
  const updatedNoteData = JSON.parse(updateNoteRes.body);
  assert(updatedNoteData.ok === true, 'Note update ok === true');
  assert(updatedNoteData.note.title.includes('SELESAI DITRANSFER'), 'Updated note title contains new content');

  // Check persistence of update
  const savedNotesAfterUpdate = JSON.parse(fs.readFileSync(notesFilePath, 'utf8'));
  const foundUpdated = savedNotesAfterUpdate.find(n => n.id === createdId);
  assert(foundUpdated && foundUpdated.title.includes('SELESAI DITRANSFER'), 'Updated note is persisted to file');

  // 3d. Delete the note
  const deleteNoteRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/calendar/notes?id=${encodeURIComponent(createdId)}`,
    method: 'DELETE'
  });
  assert(deleteNoteRes.statusCode === 200, `DELETE /api/calendar/notes returns 200 OK (Got ${deleteNoteRes.statusCode})`);
  const deletedData = JSON.parse(deleteNoteRes.body);
  assert(deletedData.ok === true, 'Note deletion ok === true');

  // Verify removed from persistent storage
  const savedNotesAfterDelete = JSON.parse(fs.readFileSync(notesFilePath, 'utf8'));
  const foundDeleted = savedNotesAfterDelete.find(n => n.id === createdId);
  assert(!foundDeleted, 'Deleted note is removed from data/calendar-notes.json');

  // ----------------------------------------------------
  // TEST GROUP 4: Export PDF Transaksi Real Backend
  // ----------------------------------------------------
  console.log('\n▶ Test Group 4: Export PDF Transaksi Real Backend');

  const pdfRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/transactions/export/pdf',
    method: 'GET'
  });

  assert(pdfRes.statusCode === 200, `GET /api/transactions/export/pdf returns 200 OK (Got ${pdfRes.statusCode})`);
  assert(pdfRes.headers['content-type'] === 'application/pdf', `Content-Type is application/pdf (Got ${pdfRes.headers['content-type']})`);
  assert(pdfRes.headers['content-disposition'].includes('attachment') && pdfRes.headers['content-disposition'].includes('.pdf'), 'Content-Disposition attachment .pdf');
  const isPdfHeader = pdfRes.raw.toString('ascii', 0, 5) === '%PDF-';
  assert(isPdfHeader, 'File payload begins with valid PDF magic bytes (%PDF-)');
  assert(pdfRes.raw.length > 500, `PDF size is valid and contains data (${pdfRes.raw.length} bytes)`);

  // Also check existing /api/reports/export/pdf
  const repPdfRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reports/export/pdf',
    method: 'GET'
  });
  assert(repPdfRes.statusCode === 200, `GET /api/reports/export/pdf returns 200 OK`);

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
