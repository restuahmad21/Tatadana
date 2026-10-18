const crypto = require("node:crypto");

function serverKey() {
  return process.env.MIDTRANS_SERVER_KEY || null;
}

async function createCheckout({ orderId, amount, customer }) {
  const key = serverKey();
  if (!key) return null;

  const baseUrl =
    process.env.MIDTRANS_IS_PRODUCTION === "true"
      ? "https://app.midtrans.com"
      : "https://app.sandbox.midtrans.com";
  const response = await fetch(`${baseUrl}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: amount },
      customer_details: { first_name: customer.name, email: customer.email },
      item_details: [
        {
          id: `tatadana-${orderId}`,
          price: amount,
          quantity: 1,
          name: `TataDana ${customer.plan}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json();
  if (!response.ok || !result.redirect_url)
    throw new Error(
      result.status_message ||
        "Midtrans belum dapat membuat halaman pembayaran.",
    );
  return result;
}

function verifyNotification(notification) {
  const key = serverKey();
  if (!key || !notification?.signature_key) return false;
  const digest = crypto
    .createHash("sha512")
    .update(
      `${notification.order_id}${notification.status_code}${notification.gross_amount}${key}`,
    )
    .digest();
  let supplied;
  try {
    supplied = Buffer.from(notification.signature_key, "hex");
  } catch {
    return false;
  }
  return (
    supplied.length === digest.length &&
    crypto.timingSafeEqual(supplied, digest)
  );
}

function paymentStatus(notification) {
  if (
    notification.transaction_status === "settlement" ||
    notification.transaction_status === "capture"
  )
    return "approved";
  if (["deny", "cancel", "expire"].includes(notification.transaction_status))
    return "rejected";
  return "pending";
}

module.exports = {
  createCheckout,
  paymentStatus,
  serverKey,
  verifyNotification,
};
