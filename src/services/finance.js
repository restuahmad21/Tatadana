const CATEGORY_DEFAULTS = [
  { name: "Gaji", type: "income", emoji: "💼", color: "#4d8b60" },
  { name: "Bonus", type: "income", emoji: "✨", color: "#d29a32" },
  { name: "Makanan", type: "expense", emoji: "🍜", color: "#ef7a48" },
  { name: "Transportasi", type: "expense", emoji: "🚌", color: "#4884a8" },
  { name: "Tagihan", type: "expense", emoji: "🧾", color: "#9276b2" },
  { name: "Belanja", type: "expense", emoji: "🛍️", color: "#d65c70" },
];

function jakartaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function jakartaDateTime(date = new Date()) {
  const { year, month, day, hour, minute } = jakartaParts(date);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function budgetPeriodKeys(date = new Date()) {
  const { year, month, day } = jakartaParts(date);
  const daily = `${year}-${month}-${day}`;
  const monday = new Date(`${daily}T12:00:00+07:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekly = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(monday);
  return { daily, weekly, monthly: `${year}-${month}` };
}

function ensureUserDefaults(database, userId) {
  database
    .prepare(
      `INSERT INTO wallets (user_id, name, is_default)
     SELECT ?, 'Tunai', 1
     WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE user_id = ?)`,
    )
    .run(userId, userId);

  const addCategory = database.prepare(
    "INSERT OR IGNORE INTO categories (user_id, name, type, emoji, color) VALUES (?, ?, ?, ?, ?)",
  );
  for (const category of CATEGORY_DEFAULTS) {
    addCategory.run(
      userId,
      category.name,
      category.type,
      category.emoji,
      category.color,
    );
  }

  database
    .prepare(
      "INSERT OR IGNORE INTO user_preferences (user_id, timezone) VALUES (?, ?)",
    )
    .run(userId, "Asia/Jakarta");
}

function getWallets(database, userId) {
  return database
    .prepare(
      `SELECT w.id, w.name, w.color, w.is_default, w.wallet_type, w.institution,
       w.opening_balance + COALESCE(SUM(
         CASE
           WHEN t.type = 'income' THEN t.amount
           WHEN t.type = 'expense' THEN -t.amount
           WHEN t.type = 'transfer' AND t.to_wallet_id = w.id THEN t.amount
           WHEN t.type = 'transfer' AND t.wallet_id = w.id THEN -t.amount
           ELSE 0
         END
       ), 0) AS balance
     FROM wallets w
     LEFT JOIN transactions t ON (t.wallet_id = w.id OR t.to_wallet_id = w.id)
     WHERE w.user_id = ?
     GROUP BY w.id
     ORDER BY w.is_default DESC, w.name COLLATE NOCASE`,
    )
    .all(userId);
}

function getOverview(database, userId) {
  const { year, month } = jakartaParts();
  const currentMonth = `${year}-${month}`;
  const activePeriods = budgetPeriodKeys();
  const wallets = getWallets(database, userId);
  const totals = database
    .prepare(
      `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
       COUNT(*) AS transaction_count
     FROM transactions
     WHERE user_id = ? AND substr(occurred_at, 1, 7) = ?`,
    )
    .get(userId, currentMonth);
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1 - (5 - index), 1),
    );
    return date.toISOString().slice(0, 7);
  });
  const cashflowRows = database
    .prepare(
      `SELECT substr(occurred_at, 1, 7) AS month,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
     FROM transactions WHERE user_id = ? AND substr(occurred_at, 1, 7) BETWEEN ? AND ?
     GROUP BY substr(occurred_at, 1, 7)`,
    )
    .all(userId, monthKeys[0], monthKeys[5]);
  const cashflowByMonth = new Map(cashflowRows.map((row) => [row.month, row]));
  const cashflow = monthKeys.map((key) => {
    const date = new Date(`${key}-15T12:00:00+07:00`);
    const row = cashflowByMonth.get(key);
    return {
      month: key,
      label: new Intl.DateTimeFormat("id-ID", {
        month: "short",
        timeZone: "Asia/Jakarta",
      }).format(date),
      income: row?.income || 0,
      expense: row?.expense || 0,
    };
  });

  const budgets = database
    .prepare(
      `SELECT b.id, b.period_type, b.period_key, b.limit_amount, b.alert_threshold, c.id AS category_id, c.name, c.emoji, c.color,
       COALESCE(SUM(t.amount), 0) AS spent
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = b.user_id
       AND t.type = 'expense' AND (
         (b.period_type = 'monthly' AND substr(t.occurred_at, 1, 7) = b.period_key)
         OR (b.period_type = 'daily' AND date(t.occurred_at) = b.period_key)
         OR (b.period_type = 'weekly' AND date(t.occurred_at) BETWEEN b.period_key AND date(b.period_key, '+6 days'))
       )
     WHERE b.user_id = ? AND (
       (b.period_type = 'daily' AND b.period_key = ?)
       OR (b.period_type = 'weekly' AND b.period_key = ?)
       OR (b.period_type = 'monthly' AND b.period_key = ?)
     )
     GROUP BY b.id
     ORDER BY spent * 1.0 / b.limit_amount DESC`,
    )
    .all(
      userId,
      activePeriods.daily,
      activePeriods.weekly,
      activePeriods.monthly,
    )
    .map((budget) => ({
      ...budget,
      percent: Math.min(
        100,
        Math.round((budget.spent / budget.limit_amount) * 100),
      ),
    }));

  const latest = database
    .prepare(
      `SELECT t.id, t.type, t.amount, t.note, t.occurred_at,
       c.name AS category_name, c.emoji AS category_emoji,
       w.name AS wallet_name, destination.name AS destination_wallet_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     JOIN wallets w ON w.id = t.wallet_id
     LEFT JOIN wallets destination ON destination.id = t.to_wallet_id
     WHERE t.user_id = ? ORDER BY t.occurred_at DESC, t.id DESC LIMIT 6`,
    )
    .all(userId);

  const balance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  return { currentMonth, wallets, totals, budgets, latest, balance, cashflow };
}

function getOverviewForPeriod(database, userId, filters = {}) {
  const parts = jakartaParts();
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const requested = filters.period;
  let period = ["daily", "weekly", "yearly", "custom"].includes(requested)
    ? requested
    : "monthly";
  let from;
  let to;
  let grain;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (period === "daily") {
    from = today;
    to = today;
    grain = "hour";
  } else if (period === "weekly") {
    const start = new Date(`${today}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    from = start.toISOString().slice(0, 10);
    start.setUTCDate(start.getUTCDate() + 6);
    to = start.toISOString().slice(0, 10);
    grain = "day";
  } else if (period === "yearly") {
    from = `${parts.year}-01-01`;
    to = `${parts.year}-12-31`;
    grain = "month";
  } else if (period === "custom") {
    if (
      !datePattern.test(filters.from || "") ||
      !datePattern.test(filters.to || "") ||
      filters.from > filters.to
    ) {
      throw new Error("Pilih tanggal awal dan akhir yang valid.");
    }
    const start = Date.parse(`${filters.from}T00:00:00Z`);
    const end = Date.parse(`${filters.to}T00:00:00Z`);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end - start > 366 * 24 * 60 * 60 * 1000
    ) {
      throw new Error("Rentang kustom maksimal satu tahun.");
    }
    from = filters.from;
    to = filters.to;
    grain = end - start <= 61 * 24 * 60 * 60 * 1000 ? "day" : "month";
  } else {
    period = "monthly";
    from = `${parts.year}-${parts.month}-01`;
    to = today;
    grain = "month";
  }

  const totals = database
    .prepare(
      `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
       COUNT(*) AS transaction_count
     FROM transactions WHERE user_id = ? AND date(occurred_at) BETWEEN ? AND ?`,
    )
    .get(userId, from, to);

  const expression =
    grain === "hour"
      ? "substr(occurred_at, 12, 2)"
      : grain === "day"
        ? "date(occurred_at)"
        : "substr(occurred_at, 1, 7)";
  const values = database
    .prepare(
      `SELECT ${expression} AS bucket,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
     FROM transactions WHERE user_id = ? AND date(occurred_at) BETWEEN ? AND ?
     GROUP BY bucket ORDER BY bucket`,
    )
    .all(userId, from, to);
  const byBucket = new Map(values.map((item) => [item.bucket, item]));
  const keys = [];
  if (grain === "hour") {
    for (let hour = 0; hour < 24; hour += 1)
      keys.push(String(hour).padStart(2, "0"));
  } else {
    const cursor = new Date(`${from}T12:00:00Z`);
    const end = new Date(`${to}T12:00:00Z`);
    while (cursor <= end && keys.length < 400) {
      keys.push(
        grain === "day"
          ? cursor.toISOString().slice(0, 10)
          : cursor.toISOString().slice(0, 7),
      );
      cursor.setUTCDate(cursor.getUTCDate() + (grain === "day" ? 1 : 0));
      if (grain === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  const cashflow = keys.map((key) => {
    const value = byBucket.get(key);
    const date = new Date(`${grain === "month" ? `${key}-15` : key}T12:00:00Z`);
    return {
      month: key,
      label:
        grain === "hour"
          ? `${key}:00`
          : grain === "day"
            ? new Intl.DateTimeFormat("id-ID", {
                day: "2-digit",
                month: "short",
                timeZone: "Asia/Jakarta",
              }).format(date)
            : new Intl.DateTimeFormat("id-ID", {
                month: "short",
                timeZone: "Asia/Jakarta",
              }).format(date),
      income: value?.income || 0,
      expense: value?.expense || 0,
    };
  });

  return {
    ...getOverview(database, userId),
    totals,
    cashflow,
    period,
    from,
    to,
  };
}

function getBudgetRecords(database, userId) {
  return database
    .prepare(
      `SELECT b.id, b.period_type, b.period_key, b.limit_amount, b.alert_threshold,
       c.id AS category_id, c.name, c.emoji,
       COALESCE(SUM(t.amount), 0) AS spent
     FROM budgets b JOIN categories c ON c.id = b.category_id
     LEFT JOIN transactions t ON t.user_id = b.user_id AND t.category_id = b.category_id
       AND t.type = 'expense' AND (
         (b.period_type = 'monthly' AND substr(t.occurred_at, 1, 7) = b.period_key)
         OR (b.period_type = 'daily' AND date(t.occurred_at) = b.period_key)
         OR (b.period_type = 'weekly' AND date(t.occurred_at) BETWEEN b.period_key AND date(b.period_key, '+6 days'))
       )
     WHERE b.user_id = ? GROUP BY b.id ORDER BY b.period_key DESC, c.name COLLATE NOCASE`,
    )
    .all(userId)
    .map((budget) => ({
      ...budget,
      percent: Math.min(
        100,
        Math.round((budget.spent / budget.limit_amount) * 100),
      ),
    }));
}

function parseTransaction(database, userId, input) {
  const type = input.type;
  const amount = Number(input.amount);
  const walletId = Number(input.wallet_id);
  const categoryId = input.category_id ? Number(input.category_id) : null;
  const toWalletId = input.to_wallet_id ? Number(input.to_wallet_id) : null;
  const note =
    typeof input.note === "string" ? input.note.trim().slice(0, 240) : "";
  const occurredAt =
    typeof input.occurred_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.occurred_at)
      ? `${input.occurred_at.replace("T", " ")}:00`
      : `${jakartaDateTime().replace("T", " ")}:00`;

  if (!["income", "expense", "transfer"].includes(type))
    throw new Error("Jenis transaksi tidak valid.");
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > 1_000_000_000_000
  ) {
    throw new Error(
      "Nominal harus berupa angka positif dan maksimal Rp1 triliun.",
    );
  }

  const wallet = database
    .prepare("SELECT id FROM wallets WHERE id = ? AND user_id = ?")
    .get(walletId, userId);
  if (!wallet) throw new Error("Dompet sumber tidak ditemukan.");

  if (type === "transfer") {
    const destination = database
      .prepare("SELECT id FROM wallets WHERE id = ? AND user_id = ?")
      .get(toWalletId, userId);
    if (!destination || destination.id === wallet.id)
      throw new Error("Dompet tujuan transfer tidak valid.");
    return {
      type,
      amount,
      walletId,
      toWalletId,
      categoryId: null,
      note,
      occurredAt,
    };
  }

  const category = database
    .prepare(
      "SELECT id FROM categories WHERE id = ? AND user_id = ? AND type = ?",
    )
    .get(categoryId, userId, type);
  if (!category)
    throw new Error("Pilih kategori yang sesuai dengan jenis transaksi.");
  return {
    type,
    amount,
    walletId,
    toWalletId: null,
    categoryId,
    note,
    occurredAt,
  };
}

function createTransaction(database, userId, input, source = "manual") {
  const transaction = parseTransaction(database, userId, input);
  const result = database
    .prepare(
      `INSERT INTO transactions
      (user_id, type, amount, category_id, wallet_id, to_wallet_id, note, source, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      transaction.type,
      transaction.amount,
      transaction.categoryId,
      transaction.walletId,
      transaction.toWalletId,
      transaction.note,
      source,
      transaction.occurredAt,
    );
  return Number(result.lastInsertRowid);
}

function getReport(database, userId, filters = {}) {
  const conditions = ["t.user_id = ?"];
  const params = [userId];
  if (
    filters.type &&
    ["income", "expense", "transfer"].includes(filters.type)
  ) {
    conditions.push("t.type = ?");
    params.push(filters.type);
  }
  if (filters.walletId && Number.isInteger(Number(filters.walletId))) {
    conditions.push("(t.wallet_id = ? OR t.to_wallet_id = ?)");
    params.push(Number(filters.walletId), Number(filters.walletId));
  }
  if (filters.categoryId && Number.isInteger(Number(filters.categoryId))) {
    conditions.push("t.category_id = ?");
    params.push(Number(filters.categoryId));
  }
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) {
    conditions.push("t.occurred_at >= ?");
    params.push(`${filters.from} 00:00:00`);
  }
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) {
    conditions.push("t.occurred_at <= ?");
    params.push(`${filters.to} 23:59:59`);
  }
  if (filters.search?.trim()) {
    conditions.push("(t.note LIKE ? OR c.name LIKE ?)");
    const search = `%${filters.search.trim().slice(0, 80)}%`;
    params.push(search, search);
  }

  const where = conditions.join(" AND ");
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(filters.page, 10) || 1),
  );
  const pageSize = filters.all ? 100000 : 20;
  const count = database
    .prepare(
      `SELECT COUNT(*) AS total FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE ${where}`,
    )
    .get(...params).total;
  const rows = database
    .prepare(
      `SELECT t.id, t.type, t.amount, t.note, t.occurred_at,
       c.name AS category_name, c.emoji AS category_emoji,
       w.name AS wallet_name, destination.name AS destination_wallet_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     JOIN wallets w ON w.id = t.wallet_id
     LEFT JOIN wallets destination ON destination.id = t.to_wallet_id
     WHERE ${where} ORDER BY t.occurred_at DESC, t.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  const totals = database
    .prepare(
      `SELECT
       COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE ${where}`,
    )
    .get(...params);

  return {
    rows,
    totals,
    count,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(count / pageSize)),
  };
}

function createWallet(
  database,
  userId,
  { name, color, openingBalance, isDefault, wallet_type, institution },
) {
  const cleanName = typeof name === "string" ? name.trim().slice(0, 40) : "";
  const balance = Number(openingBalance || 0);
  const type = ["cash", "bank", "ewallet"].includes(wallet_type)
    ? wallet_type
    : "cash";
  const bankName =
    typeof institution === "string" ? institution.trim().slice(0, 40) : "";
  if (!cleanName) throw new Error("Nama dompet wajib diisi.");
  if (!Number.isSafeInteger(balance) || balance < 0)
    throw new Error("Saldo awal tidak valid.");
  if (type !== "cash" && !bankName)
    throw new Error("Pilih nama bank atau e-wallet.");

  database.exec("BEGIN");
  try {
    if (isDefault)
      database
        .prepare("UPDATE wallets SET is_default = 0 WHERE user_id = ?")
        .run(userId);
    database
      .prepare(
        "INSERT INTO wallets (user_id, name, color, opening_balance, is_default, wallet_type, institution) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        userId,
        cleanName,
        /^#[\da-f]{6}$/i.test(color) ? color : "#ed6b2f",
        balance,
        isDefault ? 1 : 0,
        type,
        bankName,
      );
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE")
      throw new Error("Nama dompet sudah digunakan.");
    throw error;
  }
}

function createCategory(database, userId, { name, type, emoji, color }) {
  const cleanName = typeof name === "string" ? name.trim().slice(0, 40) : "";
  if (!cleanName || !["income", "expense"].includes(type))
    throw new Error("Nama dan jenis kategori wajib valid.");
  try {
    database
      .prepare(
        "INSERT INTO categories (user_id, name, type, emoji, color) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        userId,
        cleanName,
        type,
        (emoji || "•").slice(0, 8),
        /^#[\da-f]{6}$/i.test(color) ? color : "#ed6b2f",
      );
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE")
      throw new Error("Kategori dengan nama dan jenis itu sudah ada.");
    throw error;
  }
}

function createBudget(
  database,
  userId,
  {
    categoryId,
    month,
    period_type,
    period_date,
    period_key,
    limitAmount,
    alertThreshold,
  },
) {
  const amount = Number(limitAmount);
  const threshold = Number(alertThreshold || 80);
  const type = ["daily", "weekly", "monthly"].includes(period_type)
    ? period_type
    : "monthly";
  const rawDate =
    typeof period_date === "string"
      ? period_date
      : typeof period_key === "string"
        ? period_key
        : month;
  const dateMatch =
    typeof rawDate === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(rawDate);
  let key = "";
  if (dateMatch && type === "monthly") key = rawDate.slice(0, 7);
  if (dateMatch && type === "daily") key = rawDate.length === 10 ? rawDate : "";
  if (dateMatch && type === "weekly" && rawDate.length === 10) {
    const date = new Date(`${rawDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    key = date.toISOString().slice(0, 10);
  }
  const parsedDate = key.length === 7 ? `${key}-01` : key;
  const validDate =
    parsedDate && !Number.isNaN(Date.parse(`${parsedDate}T00:00:00Z`));
  if (
    !validDate ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !Number.isInteger(threshold) ||
    threshold < 1 ||
    threshold > 100
  ) {
    throw new Error("Periksa bulan, limit, dan ambang notifikasi budget.");
  }
  const monthKey = key.slice(0, 7);
  const category = database
    .prepare(
      "SELECT id FROM categories WHERE id = ? AND user_id = ? AND type = 'expense'",
    )
    .get(Number(categoryId), userId);
  if (!category)
    throw new Error(
      "Budget hanya dapat dibuat untuk kategori pengeluaran milik Anda.",
    );
  database
    .prepare(
      `INSERT INTO budgets (user_id, category_id, period_type, period_key, month, limit_amount, alert_threshold)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, category_id, period_type, period_key) DO UPDATE SET
       limit_amount = excluded.limit_amount, alert_threshold = excluded.alert_threshold`,
    )
    .run(userId, category.id, type, key, monthKey, amount, threshold);
}

module.exports = {
  CATEGORY_DEFAULTS,
  createBudget,
  createCategory,
  createTransaction,
  createWallet,
  budgetPeriodKeys,
  ensureUserDefaults,
  getOverview,
  getOverviewForPeriod,
  getBudgetRecords,
  getReport,
  getWallets,
  jakartaDateTime,
  jakartaParts,
};
