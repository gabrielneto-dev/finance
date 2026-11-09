import { setTimeout as delay } from "node:timers/promises";
import { claim, database } from "../lib/db.mjs";
import { processJob } from "../lib/sync.mjs";
const db = database();
let running = true;
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { running = false; });
console.log("Worker Finance ativo.");
while (running) {
  const job = claim(db);
  if (!job) { await delay(1000); continue; }
  await processJob(db, job);
}
db.close();
