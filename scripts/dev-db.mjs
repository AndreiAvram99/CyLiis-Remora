// Local-only embedded Postgres for previewing the app without Docker/Postgres.
// Data lives in ./.devdb (gitignored). Keep this process running.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, ".devdb");
const firstRun = !existsSync(dataDir);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
});

async function main() {
  if (firstRun) {
    console.log("[dev-db] initialising cluster (first run)...");
    await pg.initialise();
  }
  await pg.start();
  console.log("[dev-db] postgres started on 127.0.0.1:5432");
  try {
    await pg.createDatabase("discordcal");
    console.log("[dev-db] created database 'discordcal'");
  } catch {
    console.log("[dev-db] database 'discordcal' already exists");
  }
  console.log("[dev-db] READY (DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/discordcal)");
  // Keep the process alive.
  setInterval(() => {}, 1 << 30);
}

async function shutdown() {
  console.log("\n[dev-db] stopping...");
  try {
    await pg.stop();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error("[dev-db] failed:", err);
  process.exit(1);
});
