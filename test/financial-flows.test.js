const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const app = require("../src/app");
const database = require("../src/db/database");
const gemini = require("../src/providers/ai/gemini");
const finance = require("../src/services/finance");

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";", 1)[0] || "";
}

function csrfFrom(html) {
  const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
  assert.ok(token, "form CSRF token is rendered");
  return token;
}

test("new registrations land on the pending confirmation page", async () => {
  const nonce = crypto.randomBytes(6).toString("hex");
  const email = `pending-${nonce}@example.test`;
  let server;
  let userId;
  let cookie = "";

  try {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    let response = await fetch(`${baseUrl}/register`);
    cookie = cookieFrom(response);
    const registerHtml = await response.text();
    assert.equal(response.headers.get("cache-control"), "no-store");

    response = await submitForm(baseUrl, "/register", cookie, {
      _csrf: csrfFrom(registerHtml),
      name: "Pengguna Uji",
      email,
      password: "password-uji-123",
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/approval");
    cookie = cookieFrom(response) || cookie;

    response = await fetch(`${baseUrl}/approval`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Menunggu konfirmasi/);
    const user = database
      .prepare("SELECT id, approval_status FROM users WHERE email = ?")
      .get(email);
    assert.equal(user.approval_status, "pending");
    userId = user.id;
  } finally {
    if (userId) database.prepare("DELETE FROM users WHERE id = ?").run(userId);
    if (cookie) {
      const value = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
      const sid = value.startsWith("s:") ? value.slice(2).split(".")[0] : null;
      if (sid)
        database.prepare("DELETE FROM app_sessions WHERE sid = ?").run(sid);
    }
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});

async function submitForm(baseUrl, path, cookie, values) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie,
    },
    body: new URLSearchParams(values),
  });
}

test("bank/e-wallet, Tata AI wallet confirmation, and calendar notes use SQLite end-to-end", async () => {
  const admin = database
    .prepare(
      "SELECT id FROM users WHERE lower(email) = 'restu@tatadana.id' AND role = 'admin'",
    )
    .get();
  assert.ok(admin, "default administrator exists");

  const nonce = crypto.randomBytes(5).toString("hex");
  const bankName = `E2E Bank ${nonce}`;
  const walletName = `E2E Wallet ${nonce}`;
  const transactionNote = `beli makan 5000 qa-${nonce}`;
  const calendarNote = `Catatan qa-${nonce}`;
  const originalParseText = gemini.parseText;
  const originalGetOverviewForPeriod = finance.getOverviewForPeriod;
  const originalGetReport = finance.getReport;
  const originalGetWallets = finance.getWallets;
  const originalGetBudgetRecords = finance.getBudgetRecords;
  let server;
  let cookie = "";
  let createdNoteId;

  gemini.parseText = async (text) => ({
    type: "expense",
    amount: 5000,
    category: "Makanan",
    note: text,
  });

  try {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    let response = await fetch(`${baseUrl}/admin/login`);
    cookie = cookieFrom(response);
    const loginHtml = await response.text();
    assert.match(loginHtml, /value="restu@tatadana\.id"/);
    assert.match(loginHtml, /<form[^>]+action="\/admin\/login"/);
    const loginToken = csrfFrom(loginHtml);
    response = await submitForm(baseUrl, "/login", cookie, {
      _csrf: loginToken,
      email: "restu@tatadana.id",
      password: "restu21!",
    });
    assert.equal(response.status, 403);
    assert.match(await response.text(), /halaman masuk admin/);

    response = await submitForm(baseUrl, "/admin/login", cookie, {
      _csrf: loginToken,
      email: "restu@tatadana.id",
      password: "restu21!",
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/admin");
    cookie = cookieFrom(response) || cookie;
    const sessionId = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1))
      .slice(2)
      .split(".")[0];
    const storedSession = JSON.parse(
      database
        .prepare("SELECT sess FROM app_sessions WHERE sid = ?")
        .get(sessionId).sess,
    );
    assert.equal(storedSession.user.role, "admin");

    response = await fetch(`${baseUrl}/admin`, { headers: { cookie } });
    assert.equal(response.status, 200);

    response = await fetch(`${baseUrl}/settings`, { headers: { cookie } });
    const settingsHtml = await response.text();
    assert.match(settingsHtml, /href="\/transactions#tata-ai-chat"/);
    assert.match(settingsHtml, /CIMB Niaga/);
    assert.match(settingsHtml, /ShopeePay/);
    const settingsCsrf = csrfFrom(settingsHtml);
    response = await submitForm(baseUrl, "/settings/wallets", cookie, {
      _csrf: settingsCsrf,
      wallet_type: "bank",
      institution: "BCA",
      name: bankName,
      openingBalance: "0",
      isDefault: "",
    });
    assert.equal(response.status, 302);

    response = await submitForm(baseUrl, "/settings/wallets", cookie, {
      _csrf: settingsCsrf,
      wallet_type: "ewallet",
      institution: "GoPay",
      name: walletName,
      openingBalance: "0",
      isDefault: "",
    });
    assert.equal(response.status, 302);
    assert.deepEqual(
      database
        .prepare(
          "SELECT wallet_type, institution FROM wallets WHERE user_id = ? AND name IN (?, ?) ORDER BY wallet_type",
        )
        .all(admin.id, bankName, walletName)
        .map((row) => ({ ...row })),
      [
        { wallet_type: "bank", institution: "BCA" },
        { wallet_type: "ewallet", institution: "GoPay" },
      ],
    );

    response = await fetch(`${baseUrl}/transactions`, { headers: { cookie } });
    const transactionHtml = await response.text();
    assert.match(transactionHtml, /id="tata-ai-chat"/);
    const transactionCsrf = csrfFrom(transactionHtml);
    const initialCashBalance = finance
      .getWallets(database, admin.id)
      .find((wallet) => wallet.name === "Tunai").balance;
    response = await submitForm(baseUrl, "/transactions/assistant", cookie, {
      _csrf: transactionCsrf,
      message: transactionNote,
    });
    assert.equal(response.status, 302);
    assert.equal(
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM transactions WHERE user_id = ? AND note = ?",
        )
        .get(admin.id, transactionNote).count,
      0,
      "Tata AI must not insert before wallet confirmation",
    );
    assert.equal(
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM tata_ai_drafts WHERE user_id = ? AND draft_json LIKE ?",
        )
        .get(admin.id, `%${nonce}%`).count,
      1,
      "the parsed transaction draft is persisted while awaiting wallet selection",
    );
    response = await fetch(`${baseUrl}/transactions`, { headers: { cookie } });
    assert.match(await response.text(), /Menggunakan dompet yang mana\?/);

    response = await submitForm(baseUrl, "/transactions/assistant", cookie, {
      _csrf: transactionCsrf,
      message: "Tunai",
    });
    assert.equal(response.status, 302);
    assert.match(response.headers.get("location"), /^\/reports\?q=/);
    const transaction = database
      .prepare(
        "SELECT id, type, amount, note FROM transactions WHERE user_id = ? AND note = ?",
      )
      .get(admin.id, transactionNote);
    assert.deepEqual(
      { ...transaction },
      {
        id: transaction.id,
        type: "expense",
        amount: 5000,
        note: transactionNote,
      },
    );
    assert.equal(
      finance
        .getWallets(database, admin.id)
        .find((wallet) => wallet.name === "Tunai").balance,
      initialCashBalance - 5000,
    );
    response = await fetch(`${baseUrl}${response.headers.get("location")}`, {
      headers: { cookie },
    });
    assert.equal(response.status, 200);
    const reportsHtml = await response.text();
    assert.match(reportsHtml, new RegExp(transactionNote));
    assert.match(reportsHtml, /Tersimpan/);

    const today = finance.jakartaParts();
    const date = `${today.year}-${today.month}-${today.day}`;
    response = await fetch(
      `${baseUrl}/calendar?month=${today.year}-${today.month}&date=${date}`,
      { headers: { cookie } },
    );
    assert.equal(response.status, 200);
    const calendarHtml = await response.text();
    assert.match(
      calendarHtml,
      new RegExp(transactionNote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    const calendarCsrf = csrfFrom(calendarHtml);
    response = await submitForm(baseUrl, "/calendar/notes", cookie, {
      _csrf: calendarCsrf,
      note_date: date,
      title: "Uji kalender",
      body: calendarNote,
    });
    assert.equal(response.status, 302);
    const savedNote = database
      .prepare(
        "SELECT id, user_id, note_date, body FROM notes WHERE user_id = ? AND body = ?",
      )
      .get(admin.id, calendarNote);
    assert.ok(savedNote);
    createdNoteId = savedNote.id;

    response = await fetch(
      `${baseUrl}/calendar?month=${today.year}-${today.month}&date=${date}`,
      { headers: { cookie } },
    );
    assert.equal(response.status, 200);
    assert.match(await response.text(), new RegExp(calendarNote));

    finance.getOverviewForPeriod = () => ({
      wallets: null,
      budgets: null,
      latest: null,
      cashflow: null,
      totals: null,
      balance: null,
    });
    finance.getReport = () => null;
    finance.getWallets = () => null;
    finance.getBudgetRecords = () => null;

    response = await fetch(`${baseUrl}/dashboard`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /0 dompet aktif/);

    response = await fetch(`${baseUrl}/reports`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Belum ada transaksi/);
  } finally {
    gemini.parseText = originalParseText;
    finance.getOverviewForPeriod = originalGetOverviewForPeriod;
    finance.getReport = originalGetReport;
    finance.getWallets = originalGetWallets;
    finance.getBudgetRecords = originalGetBudgetRecords;
    if (createdNoteId)
      database
        .prepare("DELETE FROM notes WHERE id = ? AND user_id = ?")
        .run(createdNoteId, admin.id);
    database
      .prepare("DELETE FROM transactions WHERE user_id = ? AND note = ?")
      .run(admin.id, transactionNote);
    database
      .prepare(
        "DELETE FROM tata_ai_drafts WHERE user_id = ? AND draft_json LIKE ?",
      )
      .run(admin.id, `%${nonce}%`);
    database
      .prepare("DELETE FROM wallets WHERE user_id = ? AND name IN (?, ?)")
      .run(admin.id, bankName, walletName);
    if (cookie) {
      const value = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
      const sid = value.startsWith("s:") ? value.slice(2).split(".")[0] : null;
      if (sid)
        database.prepare("DELETE FROM app_sessions WHERE sid = ?").run(sid);
    }
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});
