require("dotenv").config();

const bcrypt = require("bcryptjs");
const database = require("./database");
const migrate = require("./migrate");
const { ensureUserDefaults } = require("../services/finance");
const { avatarColorForUser } = require("../services/avatar");

async function seedAdmin() {
  const name = process.env.ADMIN_NAME?.trim() || "Restu Ahmad Hidayat";
  const isProduction = process.env.NODE_ENV === "production";
  const email =
    process.env.ADMIN_EMAIL?.trim().toLowerCase() ||
    (!isProduction ? "restu@tatadana.id" : "");
  const password =
    process.env.ADMIN_PASSWORD || (!isProduction ? "Restu21!" : "");

  if (!email || !password) {
    const existingAdmin = database
      .prepare(
        "SELECT id FROM users WHERE name = ? AND role = 'admin' ORDER BY id LIMIT 1",
      )
      .get(name);
    if (existingAdmin) {
      ensureUserDefaults(database, existingAdmin.id);
      console.log(
        "Admin lokal yang sudah ada dipertahankan; set ADMIN_EMAIL dan ADMIN_PASSWORD untuk memperbaruinya.",
      );
      return;
    }
    throw new Error(
      "Set ADMIN_EMAIL dan ADMIN_PASSWORD di .env untuk membuat akun admin pertama.",
    );
  }

  const existing = database
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);
  const legacyAdmin = existing
    ? null
    : database
        .prepare("SELECT id FROM users WHERE email = ? AND role = 'admin'")
        .get("admin@tatadana.local");

  const passwordHash = await bcrypt.hash(password, 12);
  if (existing || legacyAdmin) {
    const userId = (existing || legacyAdmin).id;
    database
      .prepare(
        `UPDATE users
         SET name = ?, email = ?, password_hash = ?, role = 'admin',
             approval_status = 'approved',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(name, email, passwordHash, userId);
    database
      .prepare("UPDATE users SET avatar_color = ? WHERE id = ?")
      .run(avatarColorForUser(userId), userId);
    ensureUserDefaults(database, userId);
    console.log(`Akun admin lokal diperbarui: ${email}`);
    return;
  }

  const userId = database
    .prepare(
      "INSERT INTO users (name, email, password_hash, role, approval_status) VALUES (?, ?, ?, 'admin', 'approved')",
    )
    .run(name, email, passwordHash).lastInsertRowid;
  database
    .prepare("UPDATE users SET avatar_color = ? WHERE id = ?")
    .run(avatarColorForUser(userId), userId);
  ensureUserDefaults(database, userId);
  console.log(`Akun admin lokal dibuat: ${email}`);
}

if (require.main === module) {
  migrate()
    .then(seedAdmin)
    .then(() => database.close())
    .catch((error) => {
      console.error("Seed admin gagal:", error.message);
      database.close();
      process.exitCode = 1;
    });
}

module.exports = seedAdmin;
