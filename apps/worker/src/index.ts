import { env } from "./env.js";
import { createClient } from "./discord.js";
import { startScheduler } from "./scheduler.js";

async function main() {
  const client = createClient();
  await client.login(env.botToken());
  startScheduler(client);
}

main().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`[worker] received ${sig}, shutting down`);
    process.exit(0);
  });
}
