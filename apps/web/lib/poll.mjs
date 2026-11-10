import { enqueue } from "./db.mjs";

const MINUTE = 60_000;

// Consulta periódica do Item na Pluggy (SPEC-0002, REQ-001). Só lê o Item; nunca pede atualização ao banco.
// - Intervalo normal: PLUGGY_POLL_MINUTES, 60 por padrão.
// - Depois do horário previsto em nextAutoSyncAt, consulta a cada 10 minutos por até 2 horas,
//   até ver a sincronização nova.
// - Depois de "Atualizar no Meu Pluggy", consulta a cada 2 minutos enquanto durar watch_until.
export function pollSettings(env = process.env) {
  const minutes = Number(env.PLUGGY_POLL_MINUTES);
  return {
    interval: (Number.isFinite(minutes) && minutes >= 15 ? minutes : 60) * MINUTE,
    expected: 10 * MINUTE,
    expectedWindow: 2 * 60 * MINUTE,
    watch: 2 * MINUTE,
  };
}

export const WATCH_DURATION = 30 * MINUTE;

// Quanto esperar desde a última consulta, conforme a situação da conexão.
export function pollGap(row, now, settings) {
  if (row.watch_until && now < row.watch_until) return settings.watch;
  const next = Date.parse(JSON.parse(row.details || "{}").nextAutoSyncAt ?? "");
  const seen = Date.parse(row.provider_updated_at ?? "") || 0;
  const awaiting = Number.isFinite(next) && now >= next && now - next <= settings.expectedWindow && seen < next;
  return awaiting ? settings.expected : settings.interval;
}

export function schedulePolls(db, now = Date.now(), settings = pollSettings()) {
  const rows = db.prepare(`SELECT c.id,c.details,c.provider_updated_at,c.polled_at,c.watch_until FROM connections c
    WHERE c.active=1 AND c.synced_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.item_id=c.id AND j.done=0)`).all();
  // Consultas concluídas não têm histórico útil; evita que a fila cresça a cada hora.
  db.prepare("DELETE FROM jobs WHERE kind='poll' AND done<>0 AND due<?").run(now - 24 * 60 * MINUTE);
  const mark = db.prepare("UPDATE connections SET polled_at=? WHERE id=?");
  let queued = 0;
  for (const row of rows) {
    if (row.polled_at && now - row.polled_at < pollGap(row, now, settings)) continue;
    if (enqueue(db, { itemId: row.id, kind: "poll" })) { mark.run(now, row.id); queued++; }
  }
  return queued;
}

export function watchConnection(db, owner, itemId, now = Date.now()) {
  return db.prepare("UPDATE connections SET watch_until=?, polled_at=NULL WHERE id=? AND owner=? AND active=1")
    .run(now + WATCH_DURATION, itemId, owner).changes === 1;
}
