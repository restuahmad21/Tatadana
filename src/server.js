require("dotenv").config();

const database = require("./db/database");
const migrate = require("./db/migrate");
const seedAdmin = require("./db/seed-admin");
const { startPolling } = require("./services/telegram");
const { startReminderScheduler } = require("./services/reminders");

async function start() {
  await migrate();
  await seedAdmin();

  const app = require("./app");
  const port = Number(process.env.PORT || 3000);
  const stopPolling = startPolling(database);
  const stopReminders = startReminderScheduler(database);
  const server = app.listen(port, () =>
    console.log(`TataDana berjalan di http://localhost:${port}`),
  );
  server.on("error", (error) => {
    console.error(`Server gagal memakai port ${port}:`, error.message);
    stopPolling();
    stopReminders();
    database.close();
    process.exitCode = 1;
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      stopPolling();
      stopReminders();
      server.close(() => database.close());
    });
  }
}

start().catch(async (error) => {
  console.error("TataDana gagal dijalankan:", error.message);
  database.close();
  process.exitCode = 1;
});
