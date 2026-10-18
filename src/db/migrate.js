const fs = require("node:fs/promises");
const path = require("node:path");
const database = require("./database");

async function migrate() {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const directory = path.join(__dirname, "migrations");
  const files = (await fs.readdir(directory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = database
      .prepare("SELECT 1 FROM schema_migrations WHERE name = ?")
      .get(file);
    if (applied) continue;

    const sql = await fs.readFile(path.join(directory, file), "utf8");
    database.exec("BEGIN");
    try {
      database.exec(sql);
      database
        .prepare("INSERT INTO schema_migrations (name) VALUES (?)")
        .run(file);
      database.exec("COMMIT");
      console.log(`Migrasi diterapkan: ${file}`);
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

if (require.main === module) {
  migrate()
    .then(() => database.close())
    .catch((error) => {
      console.error("Migrasi database gagal:", error.message);
      database.close();
      process.exitCode = 1;
    });
}

module.exports = migrate;
