const express = require("express");
const crypto = require("node:crypto");
const finance = require("../services/finance");
const gemini = require("../providers/ai/gemini");
const telegram = require("../services/telegram");
const { decrypt, encrypt } = require("../services/secret-vault");
const midtrans = require("../providers/payments/midtrans");

const PLAN_PRICES = { starter: 49000, pro: 99000 };

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function createFinanceRouter(database, authenticated) {
  const router = express.Router();

  function flash(req, type, message) {
    req.session.flash = { type, message };
  }

  function getCategories(userId) {
    return database
      .prepare(
        "SELECT id, name, type, emoji, color FROM categories WHERE user_id = ? ORDER BY type, name COLLATE NOCASE",
      )
      .all(userId);
  }

  router.get("/dashboard", authenticated, (req, res) => {
    finance.ensureUserDefaults(database, req.user.id);
    let overview;
    try {
      overview = finance.getOverviewForPeriod(database, req.user.id, {
        period: req.query.period,
        from: req.query.from,
        to: req.query.to,
      });
    } catch (error) {
      flash(req, "error", error.message);
      overview = finance.getOverviewForPeriod(database, req.user.id);
    }
    const data = overview && typeof overview === "object" ? overview : {};
    const wallets = asArray(data.wallets);
    overview = {
      ...data,
      balance: asNumber(
        data.balance,
        wallets.reduce((sum, wallet) => sum + asNumber(wallet.balance), 0),
      ),
      totals: {
        ...(data.totals && typeof data.totals === "object" ? data.totals : {}),
        income: asNumber(data.totals?.income),
        expense: asNumber(data.totals?.expense),
      },
      wallets,
      budgets: asArray(data.budgets),
      latest: asArray(data.latest),
      cashflow: asArray(data.cashflow),
    };
    const categories = asArray(getCategories(req.user.id));
    res.render("pages/dashboard", {
      title: "Ringkasan",
      active: "dashboard",
      overview,
      categories,
      now: finance.jakartaDateTime(),
      period: overview.period || "monthly",
      periodFrom: overview.from || "",
      periodTo: overview.to || "",
    });
  });

  router.post("/transactions", authenticated, (req, res) => {
    try {
      finance.createTransaction(database, req.user.id, req.body);
      flash(req, "success", "Transaksi berhasil dicatat.");
    } catch (error) {
      flash(req, "error", error.message);
    }
    res.redirect("/dashboard");
  });

  router.get("/transactions", authenticated, (req, res) => {
    finance.ensureUserDefaults(database, req.user.id);
    const wallets = finance.getWallets(database, req.user.id);
    const transactions = finance.getReport(database, req.user.id, {
      page: 1,
    }).rows;
    const messages = req.session.tataAiMessages || [];
    const draft = req.session.tataDraftId
      ? database
          .prepare(
            "SELECT state, expires_at FROM tata_ai_drafts WHERE id = ? AND user_id = ? AND expires_at > CURRENT_TIMESTAMP",
          )
          .get(req.session.tataDraftId, req.user.id)
      : null;
    res.render("pages/transactions", {
      title: "Transaksi",
      active: "transactions",
      wallets,
      transactions,
      messages,
      draft,
    });
  });

  router.post("/transactions/assistant", authenticated, async (req, res) => {
    const text =
      typeof req.body.message === "string"
        ? req.body.message.trim().slice(0, 240)
        : "";
    const messages = (req.session.tataAiMessages || []).slice(-7);
    const reply = (message, redirectTo = "/transactions") => {
      if (text) messages.push({ role: "user", text });
      messages.push({ role: "assistant", text: message });
      req.session.tataAiMessages = messages.slice(-8);
      res.redirect(redirectTo);
    };
    if (!text) return reply("Tulis detail transaksi terlebih dahulu.");

    let draftId = req.session.tataDraftId;
    let draft = draftId
      ? database
          .prepare(
            "SELECT id, draft_json, state FROM tata_ai_drafts WHERE id = ? AND user_id = ? AND expires_at > CURRENT_TIMESTAMP",
          )
          .get(draftId, req.user.id)
      : null;
    if (!draft && draftId) {
      database
        .prepare("DELETE FROM tata_ai_drafts WHERE id = ? AND user_id = ?")
        .run(draftId, req.user.id);
      delete req.session.tataDraftId;
      draftId = null;
    }

    if (!draft) {
      try {
        const parsed = await gemini.parseText(text);
        if (!Number.isSafeInteger(parsed.amount) || parsed.amount <= 0) {
          return reply(
            "Nominal belum terbaca. Coba contoh: beli makan 5.000 atau gajian 5jt.",
          );
        }
        draftId = crypto.randomUUID();
        database
          .prepare(
            "INSERT INTO tata_ai_drafts (id, user_id, draft_json, state, expires_at) VALUES (?, ?, ?, 'awaiting_wallet', datetime('now', '+15 minutes'))",
          )
          .run(
            draftId,
            req.user.id,
            JSON.stringify({ ...parsed, note: parsed.note || text }),
          );
        req.session.tataDraftId = draftId;
        const wallets = finance.getWallets(database, req.user.id);
        return reply(
          `Saya catat sebagai ${parsed.type === "income" ? "pemasukan" : parsed.type === "transfer" ? "transfer" : "pengeluaran"} ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(parsed.amount)}. Menggunakan dompet yang mana? ${wallets.map((wallet) => wallet.name).join(", ") || "Tambahkan dompet di Pengaturan."}`,
        );
      } catch (error) {
        return reply(`Transaksi belum dapat dipahami: ${error.message}`);
      }
    }

    const parsed = JSON.parse(draft.draft_json);
    const wallets = finance.getWallets(database, req.user.id);
    const selectedWallet = wallets.find(
      (wallet) =>
        wallet.name.toLowerCase() === text.toLowerCase() ||
        (text.match(/^\d+$/) && wallets[Number(text) - 1]?.id === wallet.id),
    );
    if (!selectedWallet) {
      return reply(
        `Saya belum menemukan dompet “${text}”. Pilih salah satu: ${wallets.map((wallet) => wallet.name).join(", ")}.`,
      );
    }

    if (draft.state === "awaiting_destination") {
      if (selectedWallet.id === parsed.wallet_id) {
        return reply(
          "Dompet tujuan harus berbeda. Pilih dompet tujuan lainnya.",
        );
      }
      try {
        finance.createTransaction(database, req.user.id, {
          type: "transfer",
          amount: parsed.amount,
          wallet_id: parsed.wallet_id,
          to_wallet_id: selectedWallet.id,
          note: parsed.note,
          occurred_at: finance.jakartaDateTime(),
        });
        database
          .prepare("DELETE FROM tata_ai_drafts WHERE id = ? AND user_id = ?")
          .run(draft.id, req.user.id);
        delete req.session.tataDraftId;
        const confirmation = `Transfer ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(parsed.amount)} dari ${wallets.find((wallet) => wallet.id === parsed.wallet_id).name} ke ${selectedWallet.name} berhasil dicatat.`;
        flash(req, "success", confirmation);
        return reply(
          confirmation,
          `/reports?q=${encodeURIComponent(parsed.note || "")}`,
        );
      } catch (error) {
        return reply(`Transfer belum tersimpan: ${error.message}`);
      }
    }

    if (parsed.type === "transfer") {
      parsed.wallet_id = selectedWallet.id;
      database
        .prepare(
          "UPDATE tata_ai_drafts SET draft_json = ?, state = 'awaiting_destination', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        )
        .run(JSON.stringify(parsed), draft.id, req.user.id);
      return reply(
        `Sumber: ${selectedWallet.name}. Sekarang, pilih dompet tujuan: ${
          wallets
            .filter((wallet) => wallet.id !== selectedWallet.id)
            .map((wallet) => wallet.name)
            .join(", ") || "tambahkan dompet lain di Pengaturan"
        }.`,
      );
    }

    const category = database
      .prepare(
        "SELECT id, name FROM categories WHERE user_id = ? AND type = ? ORDER BY CASE WHEN lower(name) = lower(?) THEN 0 ELSE 1 END, id LIMIT 1",
      )
      .get(req.user.id, parsed.type, parsed.category || "");
    if (!category)
      return reply(
        "Belum ada kategori yang cocok. Tambahkan kategori di Pengaturan lalu pilih dompetmu lagi.",
      );
    try {
      finance.createTransaction(database, req.user.id, {
        type: parsed.type,
        amount: parsed.amount,
        category_id: category.id,
        wallet_id: selectedWallet.id,
        note: parsed.note || "",
        occurred_at: finance.jakartaDateTime(),
      });
      database
        .prepare("DELETE FROM tata_ai_drafts WHERE id = ? AND user_id = ?")
        .run(draft.id, req.user.id);
      delete req.session.tataDraftId;
      const confirmation = `Tersimpan ✓ ${parsed.type === "income" ? "Pemasukan" : "Pengeluaran"} ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(parsed.amount)} dari ${selectedWallet.name} · ${category.name}.`;
      flash(req, "success", confirmation);
      return reply(
        confirmation,
        `/reports?q=${encodeURIComponent(parsed.note || "")}`,
      );
    } catch (error) {
      return reply(`Transaksi belum tersimpan: ${error.message}`);
    }
  });

  router.get("/reports", authenticated, (req, res) => {
    const filters = {
      type: req.query.type || "",
      walletId: req.query.wallet || "",
      categoryId: req.query.category || "",
      from: req.query.from || "",
      to: req.query.to || "",
      search: req.query.q || "",
      page: req.query.page || 1,
    };
    const reportData = finance.getReport(database, req.user.id, filters);
    const totals = reportData?.totals || {};
    const report = {
      ...(reportData && typeof reportData === "object" ? reportData : {}),
      rows: asArray(reportData?.rows),
      totals: {
        income: asNumber(totals.income),
        expense: asNumber(totals.expense),
      },
      count: asNumber(reportData?.count),
      page: Math.max(1, asNumber(reportData?.page, 1)),
      pages: Math.max(1, asNumber(reportData?.pages, 1)),
    };
    const wallets = asArray(finance.getWallets(database, req.user.id));
    const categories = asArray(getCategories(req.user.id));
    const budgets = asArray(finance.getBudgetRecords(database, req.user.id));
    res.render("pages/reports", {
      title: "Laporan",
      active: "reports",
      filters,
      report,
      wallets,
      categories,
      budgets,
      queryString: new URLSearchParams(
        Object.entries(filters).filter(
          ([key, value]) => key !== "page" && value,
        ),
      ).toString(),
    });
  });

  router.get("/reports/export.csv", authenticated, (req, res) => {
    const report = finance.getReport(database, req.user.id, {
      ...req.query,
      page: 1,
      all: true,
    });
    const rows = [
      ["Tanggal", "Jenis", "Catatan", "Kategori", "Dompet", "Nominal"],
      ...report.rows.map((row) => [
        row.occurred_at,
        row.type,
        row.note,
        row.category_name || (row.type === "transfer" ? "Transfer" : ""),
        row.type === "transfer"
          ? `${row.wallet_name} → ${row.destination_wallet_name}`
          : row.wallet_name,
        row.amount,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const safe = String(value ?? "").replace(/^[=+@-]/, "'$&");
            return `"${safe.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\r\n");
    res
      .type("text/csv; charset=utf-8")
      .attachment("laporan-tatadana.csv")
      .send(`\uFEFF${csv}`);
  });

  router.get("/settings", authenticated, (req, res) => {
    finance.ensureUserDefaults(database, req.user.id);
    const wallets = finance.getWallets(database, req.user.id);
    const categories = getCategories(req.user.id);
    const preferences = database
      .prepare(
        "SELECT reminder_time, timezone FROM user_preferences WHERE user_id = ?",
      )
      .get(req.user.id);
    const telegram = database
      .prepare(
        "SELECT chat_id, enabled, updated_at, link_code, transport FROM telegram_integrations WHERE user_id = ?",
      )
      .get(req.user.id);
    res.render("pages/settings", {
      title: "Pengaturan",
      active: "settings",
      wallets,
      categories,
      preferences,
      telegram,
      currentMonth: `${finance.jakartaParts().year}-${finance.jakartaParts().month}`,
      webhookConfigured: /^https:\/\//i.test(process.env.PUBLIC_BASE_URL || ""),
    });
  });

  router.post("/settings/telegram/test", authenticated, async (req, res) => {
    const token =
      typeof req.body.bot_token === "string" ? req.body.bot_token.trim() : "";
    if (!/^\d{5,15}:[A-Za-z0-9_-]{20,}$/.test(token)) {
      flash(req, "error", "Format token bot Telegram tidak valid.");
      return res.redirect("/settings");
    }
    try {
      const bot = await telegram.getBot(token);
      await telegram.telegramCall(token, "deleteWebhook", {
        drop_pending_updates: false,
      });
      const linkCode = `TD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      database
        .prepare(
          `INSERT INTO telegram_integrations (user_id, encrypted_token, link_code, enabled, transport)
         VALUES (?, ?, ?, 1, 'polling')
         ON CONFLICT(user_id) DO UPDATE SET encrypted_token = excluded.encrypted_token,
           link_code = excluded.link_code, chat_id = NULL, polling_offset = 0,
           webhook_secret = NULL, transport = 'polling', enabled = 1,
           updated_at = CURRENT_TIMESTAMP`,
        )
        .run(req.user.id, encrypt(token), linkCode);
      flash(
        req,
        "success",
        `Bot @${bot.username} terhubung. Kirim /start ${linkCode} ke bot tersebut.`,
      );
    } catch (error) {
      flash(req, "error", `Tes Telegram gagal: ${error.message}`);
    }
    res.redirect("/settings");
  });

  router.post("/settings/telegram/webhook", authenticated, async (req, res) => {
    const integration = database
      .prepare(
        "SELECT encrypted_token, transport FROM telegram_integrations WHERE user_id = ? AND enabled = 1",
      )
      .get(req.user.id);
    if (!integration) {
      flash(req, "error", "Hubungkan bot Telegram terlebih dahulu.");
      return res.redirect("/settings");
    }

    const token = decrypt(integration.encrypted_token);
    if (req.body.action === "polling") {
      try {
        await telegram.telegramCall(token, "deleteWebhook", {
          drop_pending_updates: false,
        });
        database
          .prepare(
            "UPDATE telegram_integrations SET transport = 'polling', webhook_secret = NULL WHERE user_id = ?",
          )
          .run(req.user.id);
        flash(req, "success", "Bot memakai polling lokal.");
      } catch (error) {
        flash(req, "error", `Polling belum dapat diaktifkan: ${error.message}`);
      }
      return res.redirect("/settings");
    }

    const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
    if (!baseUrl || !/^https:\/\//i.test(baseUrl)) {
      flash(
        req,
        "error",
        "Isi PUBLIC_BASE_URL HTTPS (contoh URL ngrok) sebelum mengaktifkan webhook.",
      );
      return res.redirect("/settings");
    }
    const secret = crypto.randomBytes(32).toString("base64url");
    try {
      await telegram.telegramCall(token, "setWebhook", {
        url: `${baseUrl}/webhooks/telegram/${req.user.id}`,
        secret_token: secret,
        allowed_updates: ["message"],
      });
      database
        .prepare(
          "UPDATE telegram_integrations SET transport = 'webhook', webhook_secret = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
        )
        .run(encrypt(secret), req.user.id);
      flash(
        req,
        "success",
        "Webhook aktif. Polling lokal untuk bot ini dihentikan otomatis.",
      );
    } catch (error) {
      flash(
        req,
        "error",
        `Webhook Telegram gagal diaktifkan: ${error.message}`,
      );
    }
    res.redirect("/settings");
  });

  router.post("/settings/profile", authenticated, (req, res) => {
    const name =
      typeof req.body.name === "string"
        ? req.body.name.trim().slice(0, 80)
        : "";
    const contactEmail =
      typeof req.body.contact_email === "string"
        ? req.body.contact_email.trim().toLowerCase()
        : "";
    const jobTitle =
      typeof req.body.job_title === "string"
        ? req.body.job_title.trim().slice(0, 80)
        : "";
    const bio =
      typeof req.body.bio === "string" ? req.body.bio.trim().slice(0, 280) : "";
    if (!name) flash(req, "error", "Nama tidak boleh kosong.");
    else if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      flash(req, "error", "Format email kontak tidak valid.");
    } else {
      database
        .prepare(
          "UPDATE users SET name = ?, contact_email = ?, job_title = ?, bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .run(name, contactEmail, jobTitle, bio, req.user.id);
      flash(req, "success", "Profil berhasil diperbarui.");
    }
    res.redirect("/settings");
  });

  router.post("/settings/wallets", authenticated, (req, res) => {
    try {
      finance.createWallet(database, req.user.id, req.body);
      flash(req, "success", "Dompet berhasil ditambahkan.");
    } catch (error) {
      flash(req, "error", error.message);
    }
    res.redirect("/settings");
  });

  router.post("/settings/categories", authenticated, (req, res) => {
    try {
      finance.createCategory(database, req.user.id, req.body);
      flash(req, "success", "Kategori berhasil ditambahkan.");
    } catch (error) {
      flash(req, "error", error.message);
    }
    res.redirect("/settings");
  });

  router.post("/settings/budgets", authenticated, (req, res) => {
    try {
      finance.createBudget(database, req.user.id, req.body);
      flash(req, "success", "Budget kategori berhasil disimpan.");
    } catch (error) {
      flash(req, "error", error.message);
    }
    res.redirect("/settings");
  });

  router.get("/budgets", authenticated, (req, res) => {
    finance.ensureUserDefaults(database, req.user.id);
    const period = ["daily", "weekly", "monthly"].includes(req.query.period)
      ? req.query.period
      : "monthly";
    const budgets = finance
      .getBudgetRecords(database, req.user.id)
      .filter((budget) => budget.period_type === period);
    const categories = getCategories(req.user.id).filter(
      (category) => category.type === "expense",
    );
    res.render("pages/budgets", {
      title: "Budget",
      active: "budgets",
      budgets,
      categories,
      period,
      currentMonth: `${finance.jakartaParts().year}-${finance.jakartaParts().month}`,
      currentDate: `${finance.jakartaParts().year}-${finance.jakartaParts().month}-${finance.jakartaParts().day}`,
    });
  });

  router.post("/budgets", authenticated, (req, res) => {
    try {
      finance.createBudget(database, req.user.id, req.body);
      flash(req, "success", "Budget berhasil disimpan.");
    } catch (error) {
      flash(req, "error", error.message);
    }
    res.redirect(
      `/budgets?period=${encodeURIComponent(req.body.period_type || "monthly")}`,
    );
  });

  router.get("/calendar", authenticated, (req, res) => {
    const now = finance.jakartaParts();
    const defaultMonth = `${now.year}-${now.month}`;
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month || "")
      ? req.query.month
      : defaultMonth;
    const [year, monthNumber] = month.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const firstWeekday = new Date(
      Date.UTC(year, monthNumber - 1, 1, 12),
    ).getUTCDay();
    const mondayOffset = (firstWeekday + 6) % 7;
    const requestedDate =
      typeof req.query.date === "string" ? req.query.date : "";
    const selectedDate =
      /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
      requestedDate.startsWith(month)
        ? requestedDate
        : month === defaultMonth
          ? `${now.year}-${now.month}-${now.day}`
          : `${month}-01`;
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(daysInMonth).padStart(2, "0")}`;
    const notes = database
      .prepare(
        "SELECT id, note_date, title, body, created_at FROM notes WHERE user_id = ? AND note_date BETWEEN ? AND ? ORDER BY created_at DESC",
      )
      .all(req.user.id, startDate, endDate);
    const events = database
      .prepare(
        `SELECT date(occurred_at) AS date, COUNT(*) AS count,
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
       FROM transactions WHERE user_id = ? AND date(occurred_at) BETWEEN ? AND ?
       GROUP BY date(occurred_at)`,
      )
      .all(req.user.id, startDate, endDate);
    const eventMap = new Map(events.map((event) => [event.date, event]));
    const noteCounts = new Map();
    for (const note of notes)
      noteCounts.set(note.note_date, (noteCounts.get(note.note_date) || 0) + 1);
    const cells = [
      ...Array.from({ length: mondayOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, "0")}`;
        return {
          date,
          day: index + 1,
          noteCount: noteCounts.get(date) || 0,
          event: eventMap.get(date) || null,
        };
      }),
    ];
    while (cells.length % 7) cells.push(null);
    const selectedNotes = notes.filter(
      (note) => note.note_date === selectedDate,
    );
    const selectedTransactions = database
      .prepare(
        `SELECT t.id, t.type, t.amount, t.note, t.occurred_at,
         c.name AS category_name, c.emoji AS category_emoji, w.name AS wallet_name
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       JOIN wallets w ON w.id = t.wallet_id
       WHERE t.user_id = ? AND date(t.occurred_at) = ? ORDER BY t.occurred_at DESC, t.id DESC`,
      )
      .all(req.user.id, selectedDate);
    const previous = new Date(Date.UTC(year, monthNumber - 2, 1, 12))
      .toISOString()
      .slice(0, 7);
    const next = new Date(Date.UTC(year, monthNumber, 1, 12))
      .toISOString()
      .slice(0, 7);
    const monthLabel = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date(`${month}-15T12:00:00+07:00`));
    res.render("pages/calendar", {
      title: "Kalender",
      active: "calendar",
      month,
      monthLabel,
      selectedDate,
      cells,
      selectedNotes,
      selectedTransactions,
      previous,
      next,
    });
  });

  router.post("/calendar/notes", authenticated, (req, res) => {
    const date =
      typeof req.body.note_date === "string" ? req.body.note_date : "";
    const title =
      typeof req.body.title === "string"
        ? req.body.title.trim().slice(0, 100)
        : "";
    const body =
      typeof req.body.body === "string"
        ? req.body.body.trim().slice(0, 2000)
        : "";
    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
    if (!validDate || !body) {
      flash(req, "error", "Pilih tanggal dan isi catatan terlebih dahulu.");
    } else {
      database
        .prepare(
          "INSERT INTO notes (user_id, note_date, title, body) VALUES (?, ?, ?, ?)",
        )
        .run(req.user.id, date, title, body);
      flash(req, "success", "Catatan kalender tersimpan.");
    }
    res.redirect(
      `/calendar?month=${encodeURIComponent(date.slice(0, 7))}&date=${encodeURIComponent(date)}`,
    );
  });

  router.post("/calendar/notes/:id/delete", authenticated, (req, res) => {
    database
      .prepare("DELETE FROM notes WHERE id = ? AND user_id = ?")
      .run(Number(req.params.id), req.user.id);
    const date =
      typeof req.body.note_date === "string" ? req.body.note_date : "";
    flash(req, "success", "Catatan dihapus.");
    res.redirect(
      `/calendar?month=${encodeURIComponent(date.slice(0, 7))}&date=${encodeURIComponent(date)}`,
    );
  });

  router.post("/settings/reminder", authenticated, (req, res) => {
    const reminderTime = req.body.reminder_time || null;
    if (reminderTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
      flash(req, "error", "Format pengingat harus berupa jam dan menit.");
    } else {
      database
        .prepare(
          `INSERT INTO user_preferences (user_id, reminder_time, timezone) VALUES (?, ?, 'Asia/Jakarta')
         ON CONFLICT(user_id) DO UPDATE SET reminder_time = excluded.reminder_time`,
        )
        .run(req.user.id, reminderTime);
      flash(
        req,
        "success",
        reminderTime
          ? "Pengingat harian disimpan."
          : "Pengingat harian dimatikan.",
      );
    }
    res.redirect("/settings");
  });

  router.get("/plans", authenticated, (req, res) => {
    const subscription = database
      .prepare(
        "SELECT plan, status, starts_at, ends_at FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      )
      .get(req.user.id);
    res.render("pages/plans", {
      title: "Paket",
      active: "plans",
      subscription,
      planPrices: PLAN_PRICES,
    });
  });

  router.post("/plans/:plan/subscribe", authenticated, async (req, res) => {
    const plan = req.params.plan;
    if (!Object.hasOwn(PLAN_PRICES, plan)) {
      flash(req, "error", "Paket tidak ditemukan.");
      return res.redirect("/plans");
    }
    const subscriptionId = database
      .prepare(
        "INSERT INTO subscriptions (user_id, plan, status) VALUES (?, ?, 'pending')",
      )
      .run(req.user.id, plan).lastInsertRowid;
    const paymentId = database
      .prepare(
        "INSERT INTO payment_requests (user_id, subscription_id, provider, amount) VALUES (?, ?, 'manual', ?)",
      )
      .run(req.user.id, subscriptionId, PLAN_PRICES[plan]).lastInsertRowid;

    if (midtrans.serverKey()) {
      const orderId = `TD-${req.user.id}-${paymentId}-${Date.now()}`;
      try {
        const checkout = await midtrans.createCheckout({
          orderId,
          amount: PLAN_PRICES[plan],
          customer: { name: req.user.name, email: req.user.email, plan },
        });
        database
          .prepare(
            "UPDATE payment_requests SET provider = 'midtrans', provider_reference = ?, checkout_url = ? WHERE id = ?",
          )
          .run(orderId, checkout.redirect_url, paymentId);
        return res.redirect(checkout.redirect_url);
      } catch (error) {
        database
          .prepare(
            "INSERT INTO system_logs (user_id, level, event, detail) VALUES (?, ?, ?, ?)",
          )
          .run(
            req.user.id,
            "error",
            "midtrans_checkout_failed",
            error.message.slice(0, 300),
          );
        flash(
          req,
          "error",
          `Pembayaran belum dapat dibuat. Permintaan tersimpan untuk review admin: ${error.message}`,
        );
        return res.redirect("/plans");
      }
    }

    flash(
      req,
      "success",
      "Permintaan paket tersimpan dan menunggu konfirmasi admin.",
    );
    res.redirect("/plans");
  });

  router.post("/webhooks/midtrans", (req, res) => {
    const notification = req.body;
    if (!midtrans.verifyNotification(notification)) return res.sendStatus(403);
    const status = midtrans.paymentStatus(notification);
    const payment = database
      .prepare(
        "SELECT id, amount, status, subscription_id, user_id FROM payment_requests WHERE provider = 'midtrans' AND provider_reference = ?",
      )
      .get(notification.order_id);
    if (!payment) return res.sendStatus(404);
    if (Number(notification.gross_amount) !== payment.amount)
      return res.sendStatus(400);
    if (payment.status !== "pending") {
      return res.sendStatus(payment.status === status ? 200 : 409);
    }

    database.exec("BEGIN");
    try {
      database
        .prepare(
          "UPDATE payment_requests SET status = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .run(status, payment.id);
      if (status === "approved") {
        database
          .prepare(
            `UPDATE subscriptions SET status = 'active', starts_at = CURRENT_TIMESTAMP,
             ends_at = CASE WHEN plan = 'starter' THEN datetime('now', '+1 month') ELSE NULL END
           WHERE id = ?`,
          )
          .run(payment.subscription_id);
      } else if (status === "rejected") {
        database
          .prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ?")
          .run(payment.subscription_id);
      }
      database
        .prepare(
          "INSERT INTO system_logs (user_id, level, event, detail) VALUES (?, ?, ?, ?)",
        )
        .run(
          payment.user_id,
          "info",
          "midtrans_notification",
          `${notification.order_id}:${status}`,
        );
      database.exec("COMMIT");
      res.sendStatus(200);
    } catch (error) {
      database.exec("ROLLBACK");
      console.error("Midtrans webhook gagal:", error.message);
      res.sendStatus(500);
    }
  });

  router.post("/webhooks/telegram/:userId", async (req, res) => {
    const integration = database
      .prepare(
        "SELECT user_id, encrypted_token, chat_id, link_code, polling_offset, webhook_secret FROM telegram_integrations WHERE user_id = ? AND transport = 'webhook' AND enabled = 1",
      )
      .get(Number(req.params.userId));
    const supplied = req.get("x-telegram-bot-api-secret-token") || "";
    if (!integration?.webhook_secret) return res.sendStatus(404);

    const expected = Buffer.from(decrypt(integration.webhook_secret));
    const actual = Buffer.from(supplied);
    if (
      expected.length !== actual.length ||
      !crypto.timingSafeEqual(expected, actual)
    )
      return res.sendStatus(403);

    try {
      const token = decrypt(integration.encrypted_token);
      await telegram.processUpdate(database, token, integration, req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error("Telegram webhook gagal:", error.message);
      res.sendStatus(500);
    }
  });

  return router;
}

module.exports = createFinanceRouter;
