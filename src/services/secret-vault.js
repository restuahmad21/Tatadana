const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const keyPath = path.join(__dirname, "..", "..", "data", "app-encryption.key");

function encryptionKey() {
  if (process.env.APP_ENCRYPTION_KEY) {
    const configured = Buffer.from(process.env.APP_ENCRYPTION_KEY, "hex");
    if (configured.length !== 32)
      throw new Error("APP_ENCRYPTION_KEY harus berisi 64 karakter hex.");
    return configured;
  }

  try {
    const existing = fs.readFileSync(keyPath, "utf8").trim();
    const key = Buffer.from(existing, "hex");
    if (key.length !== 32) throw new Error("Kunci enkripsi lokal tidak valid.");
    return key;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const created = crypto.randomBytes(32);
  try {
    fs.writeFileSync(keyPath, created.toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
    return created;
  } catch (error) {
    if (error.code === "EEXIST") return encryptionKey();
    throw error;
  }
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(payload) {
  const [ivHex, tagHex, dataHex] = String(payload).split(":");
  if (!ivHex || !tagHex || !dataHex)
    throw new Error("Format rahasia tersimpan tidak valid.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = { decrypt, encrypt };
