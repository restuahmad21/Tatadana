const path = require("node:path");
const bcrypt = require("bcryptjs");
const express = require("express");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const helmet = require("helmet");
const { randomBytes } = require("node:crypto");
const database = require("./db/database");
const SQLiteSessionStore = require("./session/sqlite-session-store");
const csrfProtection = require("./middleware/csrf");
const { requireAuth, requireAdmin } = require("./middleware/auth");
const createFinanceRouter = require("./routes/finance");
const { ensureUserDefaults } = require("./services/finance");
const telegram = require("./services/telegram");
const gemini = require("./providers/ai/gemini");
const { encrypt } = require("./services/secret-vault");
const { avatarColorForUser } = require("./services/avatar");

const app = express();
const sessionSecret =
  process.env.SESSION_SECRET ||
  (() => {
    const current = database
      .prepare("SELECT value FROM app_settings WHERE name = ?")
      .get("session_secret");
    if (current) return current.value;

    const generated = randomBytes(48).toString("hex");
    database
      .prepare("INSERT INTO app_settings (name, value) VALUES (?, ?)")
      .run("session_secret", generated);
    return generated;
  })();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.disable("x-powered-by");
app.use(helmet());
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(
  session({
    store: new SQLiteSessionStore(database),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);
app.use(csrfProtection);
app.use((req, res, next) => {
  res.locals.currentUser = null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: "Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.",
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
const authenticated = requireAuth(database);

app.get("/", (req, res) => {
  res.render("pages/landing", { title: "TataDana" });
});

app.get("/login", (req, res) => {
  if (req.session.userId) {
    const user = database
      .prepare("SELECT approval_status FROM users WHERE id = ?")
      .get(req.session.userId);
    if (user?.approval_status === "approved") return res.redirect("/dashboard");
    return req.session.destroy(() => res.redirect("/login"));
  }
  res.render("pages/login", { title: "Masuk", error: null, email: "" });
});

app.post("/login", loginLimiter, async (req, res, next) => {
  const identifier =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body.password === "string" ? req.body.password : "";

  try {
    const user = database
      .prepare(
        "SELECT id, password_hash, approval_status FROM users WHERE lower(email) = ? OR lower(name) = ?",
      )
      .get(identifier, identifier);
    const validPassword =
      user && (await bcrypt.compare(password, user.password_hash));

    if (!validPassword) {
      return res.status(401).render("pages/login", {
        title: "Masuk",
        error: "Email atau password tidak cocok.",
        email: identifier,
      });
    }
    if (user.approval_status !== "approved") {
      return res.status(403).render("pages/login", {
        title: "Masuk",
        error:
          user.approval_status === "pending"
            ? "Akunmu masih menunggu persetujuan admin. Periksa status pendaftaranmu."
            : "Pendaftaran akun ini tidak disetujui admin.",
        email: identifier,
      });
    }

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.userId = user.id;
      req.session.csrfToken = require("node:crypto")
        .randomBytes(32)
        .toString("hex");
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.redirect("/dashboard");
      });
    });
  } catch (error) {
    next(error);
  }
});

app.get("/register", (req, res) => {
  if (req.session.userId) return res.redirect("/dashboard");
  if (req.session.pendingUserId) return res.redirect("/approval");
  res.render("pages/register", {
    title: "Buat akun",
    error: null,
    name: "",
    email: "",
  });
});

app.post("/register", registerLimiter, async (req, res, next) => {
  if (req.session.userId) return res.redirect("/dashboard");
  if (req.session.pendingUserId) return res.redirect("/approval");
  const name =
    typeof req.body.name === "string" ? req.body.name.trim().slice(0, 80) : "";
  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body.password === "string" ? req.body.password : "";
  if (
    name.length < 2 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 10
  ) {
    return res.status(400).render("pages/register", {
      title: "Buat akun",
      error: "Isi nama dan email yang valid. Password minimal 10 karakter.",
      name,
      email,
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    database.exec("BEGIN");
    let userId;
    try {
      userId = database
        .prepare(
          "INSERT INTO users (name, email, password_hash, role, approval_status) VALUES (?, ?, ?, 'user', 'pending')",
        )
        .run(name, email, passwordHash).lastInsertRowid;
      database
        .prepare("UPDATE users SET avatar_color = ? WHERE id = ?")
        .run(avatarColorForUser(userId), userId);
      ensureUserDefaults(database, userId);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).render("pages/register", {
          title: "Buat akun",
          error: "Email sudah terdaftar.",
          name,
          email,
        });
      }
      throw error;
    }

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.pendingUserId = userId;
      req.session.csrfToken = require("node:crypto")
        .randomBytes(32)
        .toString("hex");
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.redirect("/approval");
      });
    });
  } catch (error) {
    next(error);
  }
});

app.get("/approval", (req, res) => {
  const userId = req.session.pendingUserId;
  if (!userId) return res.redirect("/register");
  const user = database
    .prepare(
      "SELECT id, name, email, approval_status, rejection_reason FROM users WHERE id = ?",
    )
    .get(userId);
  if (!user) return res.redirect("/register");
  if (user.approval_status === "approved") {
    req.session.userId = user.id;
    delete req.session.pendingUserId;
    return req.session.save(() => res.redirect("/dashboard"));
  }
  if (user.approval_status === "rejected") {
    delete req.session.pendingUserId;
  }
  res.render("pages/approval", { title: "Status pendaftaran", user });
});

app.get("/approval/status", (req, res) => {
  const userId = req.session.pendingUserId;
  if (!userId) return res.status(401).json({ status: "unknown" });
  const user = database
    .prepare(
      "SELECT id, approval_status, rejection_reason FROM users WHERE id = ?",
    )
    .get(userId);
  if (!user) return res.status(404).json({ status: "unknown" });
  if (user.approval_status === "approved") {
    req.session.userId = user.id;
    delete req.session.pendingUserId;
    return req.session.save(() =>
      res.json({ status: "approved", redirect: "/dashboard" }),
    );
  }
  if (user.approval_status === "rejected") {
    delete req.session.pendingUserId;
    return res.json({ status: "rejected", reason: user.rejection_reason });
  }
  res.json({ status: "pending" });
});

app.use(createFinanceRouter(database, authenticated));

app.get("/admin", authenticated, requireAdmin, async (req, res, next) => {
  try {
    const users = database
      .prepare(
        "SELECT id, name, email, role, approval_status, contact_email, job_title, bio, created_at FROM users ORDER BY CASE approval_status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC",
      )
      .all();
    const payments = database
      .prepare(
        `SELECT p.id, p.amount, p.provider, p.status, p.created_at, p.provider_reference,
         s.plan, u.name, u.email
       FROM payment_requests p
       JOIN subscriptions s ON s.id = p.subscription_id
       JOIN users u ON u.id = p.user_id
       ORDER BY CASE WHEN p.status = 'pending' THEN 0 ELSE 1 END, p.created_at DESC LIMIT 50`,
      )
      .all();
    const logs = database
      .prepare(
        `SELECT l.level, l.event, l.detail, l.created_at, u.email
       FROM system_logs l LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC, l.id DESC LIMIT 30`,
      )
      .all();
    const aiKeyConfigured = Boolean(gemini.apiKey());
    res.render("pages/admin", {
      title: "Super Admin",
      active: "admin",
      users,
      payments,
      logs,
      aiKeyConfigured,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/admin/users/:id", authenticated, requireAdmin, (req, res, next) => {
  const user = database
    .prepare(
      `SELECT id, name, email, role, approval_status, contact_email, job_title, bio,
       avatar_color, created_at, approved_at, rejected_at, rejection_reason
     FROM users WHERE id = ?`,
    )
    .get(Number(req.params.id));
  if (!user)
    return res
      .status(404)
      .render("pages/error", {
        title: "Akun tidak ditemukan",
        message: "Data pengguna tidak tersedia.",
      });
  const wallets = database
    .prepare(
      "SELECT id, name, wallet_type, institution, opening_balance FROM wallets WHERE user_id = ? ORDER BY is_default DESC",
    )
    .all(user.id);
  res.render("pages/admin-user", {
    title: "Profil pengguna",
    active: "admin",
    user,
    wallets,
  });
});

app.post(
  "/admin/users/:id/approval",
  authenticated,
  requireAdmin,
  (req, res) => {
    const userId = Number(req.params.id);
    const decision = req.body.decision;
    if (
      !Number.isSafeInteger(userId) ||
      !["approve", "reject"].includes(decision)
    ) {
      req.session.flash = {
        type: "error",
        message: "Keputusan approval tidak valid.",
      };
      return res.redirect("/admin");
    }
    const user = database
      .prepare(
        "SELECT id, role FROM users WHERE id = ? AND approval_status = 'pending'",
      )
      .get(userId);
    if (!user || user.role === "admin") {
      req.session.flash = {
        type: "error",
        message: "Akun tidak ditemukan atau sudah diproses.",
      };
      return res.redirect("/admin");
    }

    const status = decision === "approve" ? "approved" : "rejected";
    const reason =
      decision === "reject" && typeof req.body.reason === "string"
        ? req.body.reason.trim().slice(0, 240)
        : "";
    database
      .prepare(
        `UPDATE users SET approval_status = ?, approved_at = ?, rejected_at = ?, rejection_reason = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ? AND approval_status = 'pending'`,
      )
      .run(
        status,
        status === "approved" ? new Date().toISOString() : null,
        status === "rejected" ? new Date().toISOString() : null,
        reason,
        userId,
      );
    database
      .prepare(
        "INSERT INTO system_logs (user_id, level, event, detail) VALUES (?, ?, ?, ?)",
      )
      .run(
        userId,
        status === "approved" ? "info" : "warning",
        `registration_${status}`,
        `Pendaftaran ${status} oleh admin ${req.user.email}.`,
      );
    req.session.flash = {
      type: "success",
      message:
        status === "approved"
          ? "Akun disetujui. User dapat langsung masuk."
          : "Pendaftaran ditolak.",
    };
    res.redirect(`/admin/users/${userId}`);
  },
);

app.post(
  "/admin/integrations/gemini",
  authenticated,
  requireAdmin,
  async (req, res) => {
    const key =
      typeof req.body.api_key === "string" ? req.body.api_key.trim() : "";
    try {
      if (!key) throw new Error("API key wajib diisi.");
      await gemini.testConnection(key);
      database
        .prepare(
          `INSERT INTO service_credentials (provider, encrypted_value) VALUES ('gemini', ?)
       ON CONFLICT(provider) DO UPDATE SET encrypted_value = excluded.encrypted_value, updated_at = CURRENT_TIMESTAMP`,
        )
        .run(encrypt(key));
      database
        .prepare(
          "INSERT INTO system_logs (level, event, detail) VALUES (?, ?, ?)",
        )
        .run(
          "info",
          "gemini_key_updated",
          "Kunci Gemini diuji dan diperbarui.",
        );
      req.session.flash = {
        type: "success",
        message: "Koneksi Gemini berhasil diuji dan API key terenkripsi.",
      };
    } catch (error) {
      database
        .prepare(
          "INSERT INTO system_logs (level, event, detail) VALUES (?, ?, ?)",
        )
        .run("error", "gemini_connection_failed", error.message.slice(0, 300));
      req.session.flash = {
        type: "error",
        message: `Tes Gemini gagal: ${error.message}`,
      };
    }
    res.redirect("/admin");
  },
);

app.post(
  "/admin/integrations/gemini/remove",
  authenticated,
  requireAdmin,
  (req, res) => {
    database
      .prepare("DELETE FROM service_credentials WHERE provider = 'gemini'")
      .run();
    database
      .prepare(
        "INSERT INTO system_logs (level, event, detail) VALUES (?, ?, ?)",
      )
      .run("warning", "gemini_key_removed", "Kunci Gemini tersimpan dihapus.");
    req.session.flash = {
      type: "success",
      message: process.env.GEMINI_API_KEY
        ? "Kunci Gemini tersimpan dihapus; GEMINI_API_KEY di environment masih aktif."
        : "Kunci Gemini tersimpan dihapus.",
    };
    res.redirect("/admin");
  },
);

app.post("/admin/users/:id/role", authenticated, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const role = req.body.role;
  if (!Number.isSafeInteger(userId) || !["user", "admin"].includes(role)) {
    req.session.flash = {
      type: "error",
      message: "Perubahan akun tidak valid.",
    };
    return res.redirect("/admin");
  }
  if (userId === Number(req.user.id)) {
    req.session.flash = {
      type: "error",
      message:
        "Role akun admin yang sedang digunakan tidak dapat diubah dari sini.",
    };
    return res.redirect("/admin");
  }

  const targetUser = database
    .prepare("SELECT id, role FROM users WHERE id = ?")
    .get(userId);
  if (!targetUser) {
    req.session.flash = { type: "error", message: "Akun tidak ditemukan." };
    return res.redirect("/admin");
  }
  if (role === "user" && targetUser.role === "admin") {
    const adminCount = database
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
      .get().count;
    if (adminCount <= 1) {
      req.session.flash = {
        type: "error",
        message: "Sistem harus selalu memiliki minimal satu admin.",
      };
      return res.redirect("/admin");
    }
  }

  const result = database
    .prepare(
      "UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .run(role, userId);
  if (!result.changes) {
    req.session.flash = { type: "error", message: "Akun tidak ditemukan." };
  } else {
    database
      .prepare(
        "INSERT INTO system_logs (user_id, level, event, detail) VALUES (?, ?, ?, ?)",
      )
      .run(
        userId,
        "warning",
        "user_role_updated",
        `Role akun diubah menjadi ${role}.`,
      );
    req.session.flash = { type: "success", message: "Role akun diperbarui." };
  }
  res.redirect("/admin");
});

app.post(
  "/admin/payments/:id/:decision",
  authenticated,
  requireAdmin,
  (req, res) => {
    const decision = req.params.decision;
    const status =
      decision === "approve"
        ? "approved"
        : decision === "reject"
          ? "rejected"
          : null;
    const payment = database
      .prepare(
        "SELECT id, user_id, subscription_id FROM payment_requests WHERE id = ? AND provider = 'manual' AND status = 'pending'",
      )
      .get(Number(req.params.id));
    if (!status || !payment) {
      req.session.flash = {
        type: "error",
        message: "Pembayaran tidak ditemukan atau sudah ditinjau.",
      };
      return res.redirect("/admin");
    }

    database.exec("BEGIN");
    try {
      database
        .prepare(
          "UPDATE payment_requests SET status = ?, admin_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .run(
          status,
          typeof req.body.note === "string"
            ? req.body.note.trim().slice(0, 240)
            : null,
          payment.id,
        );
      database
        .prepare(
          `UPDATE subscriptions SET status = ?,
         starts_at = CASE WHEN ? = 'active' THEN CURRENT_TIMESTAMP ELSE starts_at END,
         ends_at = CASE WHEN ? = 'active' AND plan = 'starter' THEN datetime('now', '+1 month')
                        WHEN ? = 'active' AND plan = 'pro' THEN NULL ELSE ends_at END
       WHERE id = ?`,
        )
        .run(
          status === "approved" ? "active" : "expired",
          status === "approved" ? "active" : "expired",
          status === "approved" ? "active" : "expired",
          status === "approved" ? "active" : "expired",
          payment.subscription_id,
        );
      database
        .prepare(
          "INSERT INTO system_logs (user_id, level, event, detail) VALUES (?, ?, ?, ?)",
        )
        .run(
          payment.user_id,
          "info",
          `payment_${status}`,
          `Permintaan #${payment.id} ${status} oleh admin.`,
        );
      database.exec("COMMIT");
      req.session.flash = {
        type: "success",
        message: `Pembayaran ${status === "approved" ? "disetujui" : "ditolak"}.`,
      };
    } catch (error) {
      database.exec("ROLLBACK");
      req.session.flash = {
        type: "error",
        message: "Perubahan pembayaran gagal disimpan.",
      };
    }
    res.redirect("/admin");
  },
);

app.post("/logout", authenticated, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("connect.sid", { httpOnly: true, sameSite: "lax" });
    res.redirect("/");
  });
});

app.use((req, res) => {
  res.status(404).render("pages/error", {
    title: "Halaman tidak ditemukan",
    message: "Rute ini tidak tersedia.",
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).render("pages/error", {
    title: "Terjadi kendala",
    message:
      "Permintaan belum dapat diproses. Periksa konfigurasi aplikasi dan database.",
  });
});

module.exports = app;
