const finance = require("./finance");
const gemini = require("../providers/ai/gemini");
const { decrypt } = require("./secret-vault");

const API = "https://api.telegram.org";

async function telegramCall(token, method, payload = {}) {
  const response = await fetch(
    `${API}/bot${encodeURIComponent(token)}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(method === "getUpdates" ? 35_000 : 15_000),
    },
  );
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw new Error(result.description || `Telegram ${method} gagal.`);
  return result.result;
}

async function getBot(token) {
  return telegramCall(token, "getMe");
}

async function sendMessage(token, chatId, text) {
  return telegramCall(token, "sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

function rupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function localDateWindow(command) {
  const parts = finance.jakartaParts();
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  if (command === "hari ini") return [today, today];
  if (command === "minggu ini") {
    const current = new Date(`${today}T00:00:00+07:00`);
    const day = current.getDay();
    current.setDate(current.getDate() - ((day + 6) % 7));
    const start = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
    }).format(current);
    return [start, today];
  }
  return [`${parts.year}-${parts.month}-01`, today];
}

function sendTransactionMessage(database, userId, parsed) {
  if (parsed.type === "transfer")
    return "Transfer dari bot perlu dicatat lewat dashboard agar dompet tujuan tidak salah.";
  const category = database
    .prepare(
      "SELECT id, name FROM categories WHERE user_id = ? AND type = ? ORDER BY CASE WHEN lower(name) = lower(?) THEN 0 ELSE 1 END, id LIMIT 1",
    )
    .get(userId, parsed.type, parsed.category || "");
  const wallet = database
    .prepare(
      "SELECT id, name FROM wallets WHERE user_id = ? ORDER BY is_default DESC, id LIMIT 1",
    )
    .get(userId);
  if (!wallet || !category)
    return "Dompet atau kategori belum siap. Buka TataDana dan atur ruang keuanganmu.";
  const id = finance.createTransaction(
    database,
    userId,
    {
      type: parsed.type,
      amount: parsed.amount,
      category_id: category.id,
      wallet_id: wallet.id,
      note: parsed.note,
      occurred_at: finance.jakartaDateTime(),
    },
    "telegram",
  );
  const balances = finance.getWallets(database, userId);
  const balance = balances.find((item) => item.id === wallet.id)?.balance || 0;
  const budget =
    parsed.type === "expense"
      ? finance
          .getOverview(database, userId)
          .budgets.find((item) => item.category_id === category.id)
      : null;
  const budgetLine = budget
    ? `\nBudget ${category.name}: ${budget.percent}%${budget.percent >= budget.alert_threshold ? " · mendekati/melewati batas" : ""}`
    : "";
  return `Transaksi tersimpan ✓\n${parsed.type === "income" ? "Pemasukan" : "Pengeluaran"} ${rupiah(parsed.amount)}\n${category.name} · ${wallet.name}\nSaldo dompet: ${rupiah(balance)}${budgetLine}\nID catatan: #${id}`;
}

async function processUpdate(database, token, integration, update) {
  const message = update.message;
  if (!message?.chat?.id) return;
  const chatId = String(message.chat.id);
  const text = message.text?.trim() || message.caption?.trim() || "";
  const command = text
    .toLowerCase()
    .replace(/^\/([a-z0-9_]+)@[\w]+/i, "/$1")
    .trim();

  const duplicate = database
    .prepare(
      "SELECT 1 FROM telegram_updates WHERE user_id = ? AND update_id = ?",
    )
    .get(integration.user_id, update.update_id);
  if (duplicate) return;

  if (command.startsWith("/start")) {
    const code = text.split(/\s+/, 2)[1];
    const linked =
      code &&
      database
        .prepare(
          "SELECT user_id, encrypted_token FROM telegram_integrations WHERE link_code = ?",
        )
        .get(code);
    if (!linked || decrypt(linked.encrypted_token) !== token) {
      await sendMessage(
        token,
        chatId,
        "Untuk menghubungkan akun, buat kode pairing di Pengaturan TataDana lalu kirim /start KODE.",
      );
      return;
    }
    database
      .prepare(
        `UPDATE telegram_integrations SET chat_id = ?, link_code = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      )
      .run(chatId, linked.user_id);
    const claim = database
      .prepare(
        "INSERT OR IGNORE INTO telegram_updates (user_id, update_id) VALUES (?, ?)",
      )
      .run(linked.user_id, update.update_id);
    if (claim.changes === 0) return;
    await sendMessage(
      token,
      chatId,
      "Akun TataDana berhasil terhubung. Kirim catatan seperti “beli bakso 15rb” atau /bantuan.",
    );
    return;
  }

  if (integration.chat_id !== chatId) {
    await sendMessage(
      token,
      chatId,
      "Akun Telegram ini belum terhubung. Buat kode pairing di Pengaturan TataDana lalu kirim /start KODE.",
    );
    return;
  }

  const claim = database
    .prepare(
      "INSERT OR IGNORE INTO telegram_updates (user_id, update_id) VALUES (?, ?)",
    )
    .run(integration.user_id, update.update_id);
  if (claim.changes === 0) return;
  let reply;
  if (command === "/bantuan") {
    reply =
      "TataDana Bot\nKirim: beli bakso 15rb atau gajian 5jt\nCommands: /saldo, /hari ini, /minggu ini, /bulan ini, /budget, /bantuan\nFoto struk dan voice note tersedia di Pro dengan Gemini aktif.";
  } else if (
    [
      "/hari_ini",
      "/hari ini",
      "/minggu_ini",
      "/minggu ini",
      "/bulan_ini",
      "/bulan ini",
    ].includes(command)
  ) {
    const label = command.startsWith("/hari")
      ? "hari ini"
      : command.startsWith("/minggu")
        ? "minggu ini"
        : "bulan ini";
    const [from, to] = localDateWindow(label);
    const summary = database
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
              COUNT(*) AS count
       FROM transactions WHERE user_id = ? AND date(occurred_at) BETWEEN ? AND ?`,
      )
      .get(integration.user_id, from, to);
    reply = `${label[0].toUpperCase()}${label.slice(1)}\nPemasukan: ${rupiah(summary.income)}\nPengeluaran: ${rupiah(summary.expense)}\n${summary.count} transaksi`;
  } else if (command === "/saldo") {
    const wallets = finance.getWallets(database, integration.user_id);
    reply = `Saldo TataDana\n${wallets.map((wallet) => `${wallet.name}: ${rupiah(wallet.balance)}`).join("\n")}\nTotal: ${rupiah(wallets.reduce((total, wallet) => total + wallet.balance, 0))}`;
  } else if (command === "/budget") {
    const overview = finance.getOverview(database, integration.user_id);
    reply = overview.budgets.length
      ? `Budget bulan ini\n${overview.budgets.map((budget) => `${budget.emoji} ${budget.name}: ${rupiah(budget.spent)} / ${rupiah(budget.limit_amount)} (${budget.percent}%)`).join("\n")}`
      : "Belum ada budget. Atur budget kategori di dashboard TataDana.";
  } else if (message.photo || message.voice) {
    const activePro = database
      .prepare(
        "SELECT 1 FROM subscriptions WHERE user_id = ? AND plan = 'pro' AND status = 'active' AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP) LIMIT 1",
      )
      .get(integration.user_id);
    if (!activePro) {
      reply =
        "Fitur foto struk dan voice note tersedia di Pro. Lihat pilihan paket di TataDana.";
    } else {
      try {
        const fileId = message.photo
          ? message.photo.at(-1).file_id
          : message.voice.file_id;
        const file = await telegramCall(token, "getFile", { file_id: fileId });
        if (file.file_size > 10 * 1024 * 1024)
          throw new Error("File maksimal 10 MB.");
        const response = await fetch(
          `${API}/file/bot${encodeURIComponent(token)}/${file.file_path}`,
          { signal: AbortSignal.timeout(20_000) },
        );
        if (!response.ok) throw new Error("File Telegram tidak dapat diunduh.");
        const mimeType = message.photo
          ? "image/jpeg"
          : message.voice.mime_type || "audio/ogg";
        const parsed = await gemini.parseMedia({
          bytes: Buffer.from(await response.arrayBuffer()),
          mimeType,
          caption: text,
        });
        reply = sendTransactionMessage(database, integration.user_id, parsed);
      } catch (error) {
        reply = `Media belum dapat diproses: ${error.message}`;
      }
    }
  } else if (text && !text.startsWith("/")) {
    try {
      const parsed = await gemini.parseText(text);
      reply =
        parsed.amount > 0
          ? sendTransactionMessage(database, integration.user_id, parsed)
          : "Nominal belum terbaca. Coba format seperti “beli bakso 15rb”.";
    } catch (error) {
      reply = `Catatan belum tersimpan: ${error.message}`;
    }
  } else {
    reply = "Perintah belum dikenali. Ketik /bantuan untuk melihat contoh.";
  }

  await sendMessage(token, chatId, reply);
}

function startPolling(database, log = console) {
  let stopped = false;
  let polling = false;

  async function cycle() {
    if (stopped || polling) return;
    polling = true;
    try {
      const integrations = database
        .prepare(
          "SELECT user_id, encrypted_token, chat_id, link_code, polling_offset FROM telegram_integrations WHERE enabled = 1 AND transport = 'polling'",
        )
        .all();
      for (const integration of integrations) {
        if (stopped) break;
        const token = decrypt(integration.encrypted_token);
        try {
          const updates = await telegramCall(token, "getUpdates", {
            offset: integration.polling_offset || 0,
            timeout: 20,
            allowed_updates: ["message"],
          });
          for (const update of updates) {
            const refreshed = { ...integration };
            try {
              await processUpdate(database, token, refreshed, update);
            } catch (error) {
              log.error(`Telegram user ${integration.user_id}:`, error.message);
            }
            database
              .prepare(
                "UPDATE telegram_integrations SET polling_offset = ? WHERE user_id = ?",
              )
              .run(update.update_id + 1, integration.user_id);
          }
        } catch (error) {
          if (!/timeout/i.test(error.message))
            log.warn(
              `Polling Telegram user ${integration.user_id}: ${error.message}`,
            );
        }
      }
    } catch (error) {
      log.error("Polling Telegram gagal:", error.message);
    } finally {
      polling = false;
      if (!stopped) setTimeout(cycle, 500);
    }
  }

  cycle();
  return () => {
    stopped = true;
  };
}

module.exports = {
  getBot,
  processUpdate,
  sendMessage,
  startPolling,
  telegramCall,
};
