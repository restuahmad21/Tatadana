const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const finance = require("../src/services/finance");
const gemini = require("../src/providers/ai/gemini");

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const migrations = path.join(__dirname, "..", "src", "db", "migrations");
  for (const file of fs
    .readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    database.exec(fs.readFileSync(path.join(migrations, file), "utf8"));
  }
  return database;
}

function createUser(database, email) {
  return Number(
    database
      .prepare(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, 'hash', 'user')",
      )
      .run(email.split("@")[0], email).lastInsertRowid,
  );
}

test("nominal Indonesia diterjemahkan ke rupiah integer", () => {
  assert.equal(gemini.parseAmount("beli bakso 15rb"), 15000);
  assert.equal(gemini.parseAmount("gajian 5jt"), 5000000);
  assert.equal(gemini.parseAmount("terima 1,5 juta"), 1500000);
  assert.equal(gemini.parseAmount("bayar Rp 1.250.000"), 1250000);
  assert.equal(gemini.parseAmount("tidak menyebut nominal"), 0);
  assert.equal(gemini.localParse("transfer 50rb").type, "transfer");
});

test("akun baru mulai dengan wallet Rp0 dan tanpa transaksi", () => {
  const database = createDatabase();
  try {
    const userId = createUser(database, "satu@example.test");
    finance.ensureUserDefaults(database, userId);
    const overview = finance.getOverview(database, userId);
    assert.equal(overview.balance, 0);
    assert.equal(overview.wallets.length, 1);
    assert.equal(overview.wallets[0].name, "Tunai");
    assert.equal(overview.totals.transaction_count, 0);
    assert.equal(overview.latest.length, 0);
  } finally {
    database.close();
  }
});

test("saldo dan laporan menghitung pemasukan, pengeluaran, dan transfer", () => {
  const database = createDatabase();
  try {
    const userId = createUser(database, "saldo@example.test");
    finance.ensureUserDefaults(database, userId);
    const [cash] = finance.getWallets(database, userId);
    finance.createTransaction(database, userId, {
      type: "income",
      amount: 5000000,
      category_id: database
        .prepare(
          "SELECT id FROM categories WHERE user_id = ? AND type = 'income' LIMIT 1",
        )
        .get(userId).id,
      wallet_id: cash.id,
      note: "Gaji",
    });
    finance.createTransaction(database, userId, {
      type: "expense",
      amount: 15000,
      category_id: database
        .prepare(
          "SELECT id FROM categories WHERE user_id = ? AND type = 'expense' LIMIT 1",
        )
        .get(userId).id,
      wallet_id: cash.id,
      note: "Bakso",
    });
    finance.createWallet(database, userId, {
      name: "BCA",
      openingBalance: 0,
      isDefault: false,
    });
    const bca = finance
      .getWallets(database, userId)
      .find((wallet) => wallet.name === "BCA");
    finance.createTransaction(database, userId, {
      type: "transfer",
      amount: 1000000,
      wallet_id: cash.id,
      to_wallet_id: bca.id,
      note: "Simpan gaji",
    });

    const wallets = finance.getWallets(database, userId);
    assert.equal(
      wallets.find((wallet) => wallet.id === cash.id).balance,
      3985000,
    );
    assert.equal(
      wallets.find((wallet) => wallet.id === bca.id).balance,
      1000000,
    );
    assert.equal(finance.getOverview(database, userId).balance, 4985000);
    const report = finance.getReport(database, userId, { type: "expense" });
    assert.equal(report.count, 1);
    assert.equal(report.totals.expense, 15000);
  } finally {
    database.close();
  }
});

test("wallet dan kategori akun lain tidak dapat dipakai", () => {
  const database = createDatabase();
  try {
    const owner = createUser(database, "owner@example.test");
    const attacker = createUser(database, "attacker@example.test");
    finance.ensureUserDefaults(database, owner);
    finance.ensureUserDefaults(database, attacker);
    const [wallet] = finance.getWallets(database, owner);
    const category = database
      .prepare(
        "SELECT id FROM categories WHERE user_id = ? AND type = 'expense' LIMIT 1",
      )
      .get(attacker);
    assert.throws(
      () =>
        finance.createTransaction(database, attacker, {
          type: "expense",
          amount: 10000,
          wallet_id: wallet.id,
          category_id: category.id,
        }),
      /Dompet sumber tidak ditemukan/,
    );
  } finally {
    database.close();
  }
});

test("budget hanya dapat memakai kategori pengeluaran milik akun sendiri", () => {
  const database = createDatabase();
  try {
    const userId = createUser(database, "budget@example.test");
    finance.ensureUserDefaults(database, userId);
    const category = database
      .prepare(
        "SELECT id FROM categories WHERE user_id = ? AND type = 'expense' LIMIT 1",
      )
      .get(userId);
    finance.createBudget(database, userId, {
      categoryId: category.id,
      month: "2026-10",
      limitAmount: 1500000,
      alertThreshold: 80,
    });
    const overview = finance.getOverview(database, userId);
    assert.equal(overview.budgets.length, 1);
    assert.equal(overview.budgets[0].percent, 0);
    assert.throws(
      () =>
        finance.createBudget(database, userId, {
          categoryId: category.id,
          month: "2026-10",
          limitAmount: -1,
        }),
      /budget/i,
    );
  } finally {
    database.close();
  }
});
