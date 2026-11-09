const dayMs = 86_400_000;
export const dateText = (day) => new Date(day * dayMs).toISOString().slice(0, 10);

export function dayNumber(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const day = Date.parse(date) / dayMs;
  return Number.isInteger(day) && dateText(day) === date ? day : null;
}

export function median(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

export function nextByDay(today, last, closeDay) {
  const start = new Date(Math.max(today, last) * dayMs);
  start.setUTCDate(1);
  if (dateText(start.getTime() / dayMs).slice(0, 7) === dateText(last).slice(0, 7)) {
    start.setUTCMonth(start.getUTCMonth() + 1);
  }
  const inMonth = () => {
    const days = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
    return start.getTime() / dayMs + Math.min(closeDay, days) - 1;
  };
  let next = inMonth();
  if (next < today || next <= last) {
    start.setUTCMonth(start.getUTCMonth() + 1);
    next = inMonth();
  }
  return next;
}

function closingWindows(bills, activity, today) {
  const dated = bills.filter(({ due }) => due !== null).toSorted((a, b) => a.due - b.due);
  const byBill = new Map(activity.map((row) => [row.billId, row]));
  const windows = [];
  for (let i = 1; i < dated.length; i++) {
    const previous = dated[i - 1];
    const current = dated[i];
    if (current.due - previous.due < 25 || current.due - previous.due > 35) continue;
    const last = dayNumber(byBill.get(previous.id)?.last);
    const first = dayNumber(byBill.get(current.id)?.first);
    if (last === null || first === null || first > today ||
        first <= last || first - last > 8 || last > previous.due || previous.due - last > 35) continue;
    const close = Math.floor((last + Math.min(first - 1, previous.due)) / 2);
    windows.push({ close, due: previous.due });
  }
  return windows;
}

export function cardCycle(card, bills, activity, reference) {
  const today = dayNumber(reference);
  const reportedDue = dayNumber(card.due);
  const reportedClose = dayNumber(card.closes);
  const dated = bills.map(({ id, due, closes }) => ({ id, due: dayNumber(due), close: dayNumber(closes) }));
  const official = dated.filter(({ close, due }) => close !== null && (due === null || close <= due));
  const upcoming = official.filter(({ close }) => close >= today).sort((a, b) => a.close - b.close)[0];
  const history = official.filter(({ close }) => close < today);
  if (reportedClose !== null && reportedClose < today && (reportedDue === null || reportedDue >= reportedClose) &&
      !history.some(({ close, due }) => close === reportedClose || (due !== null && due === reportedDue))) {
    history.push({ close: reportedClose, due: reportedDue });
  }
  history.sort((a, b) => a.close - b.close);
  const lastOfficial = history.at(-1);
  const result = (close, source) => ({
    itemId: card.itemId, accountId: card.id, nextClosing: close === null ? null : dateText(close), source,
    lastClosing: lastOfficial ? dateText(lastOfficial.close) : null,
  });
  if (reportedClose !== null && reportedClose >= today && (reportedDue === null || reportedClose <= reportedDue) &&
      (!upcoming || reportedClose <= upcoming.close)) return result(reportedClose, "card");
  if (upcoming) return result(upcoming.close, "bill");

  const observations = history.length ? history : closingWindows(dated, activity, today);
  const recent = observations.slice(-6);
  if (!recent.length) return result(null, null);
  const last = recent.at(-1).close;
  const day = median(recent.map(({ close }) => Number(dateText(close).slice(-2))));
  const recurringClose = nextByDay(today, last, day);
  const gaps = recent.map(({ close, due }) => due === null ? null : due - close)
    .filter((gap) => gap !== null && gap > 0 && gap <= 35);
  const latestHistoricalDue = Math.max(...dated.filter(({ close, due }) => due !== null && close !== null && close < today)
    .map(({ due }) => due), ...recent.map(({ due }) => due ?? -Infinity));
  const nextDue = [reportedDue, ...dated.map(({ due }) => due)].filter((due) =>
    due !== null && due >= today && due > latestHistoricalDue).sort((a, b) => a - b)[0];
  const estimatedFromDue = nextDue !== undefined && gaps.length ? nextDue - median(gaps) : null;
  const next = estimatedFromDue !== null && estimatedFromDue >= today && estimatedFromDue - last >= 21 &&
    Math.abs(estimatedFromDue - recurringClose) <= 7 ? estimatedFromDue : recurringClose;
  return result(next, history.length ? "history" : "transactions");
}
