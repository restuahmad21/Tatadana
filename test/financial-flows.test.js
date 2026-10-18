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

    let response = await fetch(`${baseUrl}/login`);
    cookie = cookieFrom(response);
    const loginHtml = await response.text();
    response = await submitForm(baseUrl, "/login", cookie, {
      _csrf: csrfFrom(loginHtml),
      email: "restu@tatadana.id",
      password: "Restu21!",
    });
    assert.equal(response.status, 302);
    cookie = cookieFrom(response) || cookie;

    response = await fetch(`${baseUrl}/settings`, { headers: { cookie } });
    const settingsHtml = await response.text();
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
    const transactionCsrf = csrfFrom(transactionHtml);
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

    response = await submitForm(baseUrl, "/transactions/assistant", cookie, {
      _csrf: transactionCsrf,
      message: "Tunai",
    });
    assert.equal(response.status, 302);
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
  } finally {
    gemini.parseText = originalParseText;
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
