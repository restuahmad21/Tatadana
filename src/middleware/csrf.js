const { randomBytes, timingSafeEqual } = require("node:crypto");

function csrfProtection(req, res, next) {
  if (req.path.startsWith("/webhooks/")) return next();
  res.set("Cache-Control", "no-store");
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (req.method === "POST") {
    const submitted = req.body?._csrf;
    const expected = req.session.csrfToken;
    const submittedBuffer =
      typeof submitted === "string" ? Buffer.from(submitted) : Buffer.alloc(0);
    const expectedBuffer = Buffer.from(expected);
    if (
      typeof submitted !== "string" ||
      submittedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(submittedBuffer, expectedBuffer)
    ) {
      return res.status(403).render("pages/error", {
        title: "Permintaan tidak valid",
        message:
          "Sesi formulir berakhir atau token tidak cocok. Muat ulang halaman lalu coba lagi.",
      });
    }
  }

  next();
}

module.exports = csrfProtection;
