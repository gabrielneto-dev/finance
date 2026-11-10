import { setTimeout as delay } from "node:timers/promises";
import { claim, database } from "../lib/db.mjs";
import { processJob } from "../lib/sync.mjs";
import { pollSettings, schedulePolls } from "../lib/poll.mjs";
const db = database();
let running = true;
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { running = false; });
const settings = pollSettings();
console.log("Worker Finance ativo. Consulta à Pluggy a cada %d minutos.", settings.interval / 60_000);
let scheduled = 0;
while (running) {
  if (Date.now() - scheduled >= 60_000) {
    scheduled = Date.now();
    try { schedulePolls(db, scheduled, settings); } catch (error) { console.warn("Agenda de consultas falhou: %s", error instanceof Error ? error.message : error); }
  }
  const job = claim(db);
  if (!job) { await delay(1000); continue; }
  await processJob(db, job);
}
db.close();
