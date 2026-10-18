const database = require("../../db/database");
const { decrypt } = require("../../services/secret-vault");

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const responseSchema = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: ["income", "expense", "transfer"] },
    amount: { type: "INTEGER" },
    category: { type: "STRING" },
    note: { type: "STRING" },
  },
  required: ["type", "amount", "category", "note"],
};

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const saved = database
    .prepare(
      "SELECT encrypted_value FROM service_credentials WHERE provider = ?",
    )
    .get("gemini");
  return saved ? decrypt(saved.encrypted_value) : null;
}

function parseAmount(text) {
  const match = text.match(
    /(?:rp\s*)?\d[\d.,]*(?:\s*(?:ribu|rb|juta|jt|juta-an|k|m))?/i,
  );
  if (!match) return 0;
  const value = match[0].replace(/^rp\s*/i, "").trim();
  const suffixMatch = value.match(/\s*(ribu|rb|juta(?:-an)?|jt|k|m)$/i);
  const suffix = suffixMatch?.[1]?.toLowerCase() || "";
  const numeric = suffixMatch
    ? value.slice(0, suffixMatch.index).trim()
    : value;
  let amount;

  if (numeric.includes(",") && numeric.includes(".")) {
    amount =
      numeric.lastIndexOf(",") > numeric.lastIndexOf(".")
        ? Number(numeric.replace(/\./g, "").replace(",", "."))
        : Number(numeric.replace(/,/g, ""));
  } else if (numeric.includes(",")) {
    const decimals = numeric.split(",")[1];
    amount =
      decimals.length <= 2
        ? Number(numeric.replace(",", "."))
        : Number(numeric.replace(/,/g, ""));
  } else if (numeric.includes(".")) {
    const decimals = numeric.split(".")[1];
    amount =
      decimals.length <= 2 &&
      numeric.split(".").length === 2 &&
      (!suffix || decimals.length === 1)
        ? Number(numeric)
        : Number(numeric.replace(/\./g, ""));
  } else {
    amount = Number(numeric);
  }

  const multiplier = /^(juta|juta-an|jt|m)$/.test(suffix)
    ? 1_000_000
    : suffix
      ? 1_000
      : 1;
  return Number.isSafeInteger(Math.round(amount * multiplier))
    ? Math.round(amount * multiplier)
    : 0;
}

function localParse(text) {
  const amount = parseAmount(text);
  const lower = text.toLowerCase();
  const type = /\b(transfer|pindah(?:kan)?)\b/.test(lower)
    ? "transfer"
    : /\b(terima|gajian|gaji|bonus|dibayar|pemasukan|jual)\b/.test(lower)
      ? "income"
      : "expense";
  const category =
    type === "income"
      ? "Gaji"
      : /\b(bensin|grab|gojek|ojek|bus|kereta|parkir)\b/.test(lower)
        ? "Transportasi"
        : /\b(tagihan|listrik|internet|air)\b/.test(lower)
          ? "Tagihan"
          : /\b(beli|belanja|mall|toko)\b/.test(lower)
            ? "Belanja"
            : "Makanan";
  return { type, amount, category, note: text.trim().slice(0, 160) };
}

async function generate(contents) {
  const key = apiKey();
  if (!key) return null;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Gemini menolak permintaan (${response.status}). Periksa API key dan kuota.`,
    );
  const result = await response.json();
  const raw = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("");
  if (!raw) throw new Error("Gemini tidak mengembalikan data transaksi.");
  const parsed = JSON.parse(raw);
  if (
    !["income", "expense", "transfer"].includes(parsed.type) ||
    !Number.isSafeInteger(parsed.amount) ||
    parsed.amount <= 0
  ) {
    throw new Error("Hasil AI bukan transaksi yang valid.");
  }
  return parsed;
}

async function parseText(text) {
  const prompt = `Ubah pesan keuangan Indonesia menjadi satu transaksi. Nominal dalam rupiah integer; 15rb=15000, 5jt=5000000, 1,5 juta=1500000. Tentukan type income/expense/transfer. Jangan menebak jika tidak ada nominal. Pilih kategori paling sesuai. Teks: ${text}`;
  return (
    (await generate([{ role: "user", parts: [{ text: prompt }] }])) ||
    localParse(text)
  );
}

async function parseMedia({ bytes, mimeType, caption = "" }) {
  const parsed = await generate([
    {
      role: "user",
      parts: [
        {
          text: `Ekstrak satu transaksi keuangan Indonesia dari media ini. Untuk struk, gunakan total akhir yang dibayar. Caption: ${caption || "(tidak ada)"}`,
        },
        { inlineData: { mimeType, data: bytes.toString("base64") } },
      ],
    },
  ]);
  if (!parsed) throw new Error("AI Gemini belum dikonfigurasi.");
  return parsed;
}

async function testConnection(key) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Balas: siap" }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok)
    throw new Error(`Tes Gemini gagal (${response.status}). Periksa API key.`);
  return true;
}

module.exports = {
  MODEL,
  apiKey,
  localParse,
  parseAmount,
  parseMedia,
  parseText,
  testConnection,
};
