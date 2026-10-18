const { decrypt } = require("./secret-vault");
const { jakartaParts } = require("./finance");
const { sendMessage } = require("./telegram");

function startReminderScheduler(database, log = console) {
  let running = false;

  async function checkReminders() {
    if (running) return;
    running = true;
    try {
      const now = jakartaParts();
      const today = `${now.year}-${now.month}-${now.day}`;
      const currentTime = `${now.hour}:${now.minute}`;
      const due = database
        .prepare(
          `SELECT p.user_id, p.reminder_time, p.reminder_sent_on, t.encrypted_token, t.chat_id
         FROM user_preferences p
         JOIN telegram_integrations t ON t.user_id = p.user_id
         WHERE p.reminder_time = ? AND (p.reminder_sent_on IS NULL OR p.reminder_sent_on != ?)
           AND t.enabled = 1 AND t.chat_id IS NOT NULL`,
        )
        .all(currentTime, today);

      for (const item of due) {
        try {
          await sendMessage(
            decrypt(item.encrypted_token),
            item.chat_id,
            "Pengingat TataDana: sempatkan catat pemasukan dan pengeluaran hari ini, ya.",
          );
          database
            .prepare(
              "UPDATE user_preferences SET reminder_sent_on = ? WHERE user_id = ?",
            )
            .run(today, item.user_id);
        } catch (error) {
          log.warn(`Pengingat user ${item.user_id} gagal: ${error.message}`);
        }
      }
    } catch (error) {
      log.error("Pemeriksaan pengingat gagal:", error.message);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(checkReminders, 20_000);
  timer.unref();
  checkReminders();
  return () => clearInterval(timer);
}

module.exports = { startReminderScheduler };
