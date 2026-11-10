import { dateText, dayNumber, median, nextByDay } from "./card-cycle.mjs";

const isMonth = (value) => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const cardKey = (row) => row.itemId + "/" + row.accountId;

function addMonths(month, offset) {
  const [year, number] = month.split("-").map(Number);
  const index = year * 12 + number - 1 + offset;
  return String(Math.floor(index / 12)).padStart(4, "0") + "-" + String(index % 12 + 1).padStart(2, "0");
}

const RECENT_CYCLES = 6;
const MAX_DUE_GAP_DAYS = 35;

// Ciclos oficiais por cartão, com a data de vencimento quando válida.
function closingCycles(bills) {
  const byCard = new Map();
  for (const bill of bills) {
    const close = dayNumber(bill.closes);
    if (close === null) continue;
    const due = dayNumber(bill.due);
    const key = cardKey(bill);
    if (!byCard.has(key)) byCard.set(key, []);
    byCard.get(key).push({ close, due: due !== null && due >= close && due - close <= MAX_DUE_GAP_DAYS ? due : null });
  }
  return new Map([...byCard].map(([key, rows]) => [key, rows.toSorted((a, b) => a.close - b.close)]));
}

// Lançamento PENDING sem fatura pertence ao ciclo ainda aberto na data de referência.
// A compra feita no dia do fechamento entra no ciclo seguinte.
function cycleMonth(cycles, date, today) {
  const day = dayNumber(date?.slice(0, 10));
  if (!cycles || day === null) return null;
  const isOpen = ({ close }) => today === null || close >= today;
  const open = cycles.find((cycle) => isOpen(cycle) && cycle.close > day && cycle.due !== null);
  if (open) return dateText(open.due).slice(0, 7);
  const closed = cycles.filter((cycle) => !isOpen(cycle)).slice(-RECENT_CYCLES);
  const recent = closed.length ? closed : cycles.slice(-RECENT_CYCLES);
  const gaps = recent.filter(({ due }) => due !== null).map(({ close, due }) => due - close);
  if (!gaps.length) return null;
  const closeDay = median(recent.map(({ close }) => Number(dateText(close).slice(-2))));
  const close = nextByDay(Math.max(day + 1, today ?? -Infinity), recent.at(-1).close, closeDay);
  return dateText(close + median(gaps)).slice(0, 7);
}

// Mês de vencimento do ciclo aberto na data de referência, o mesmo dado às parcelas pendentes sem fatura.
export function openCycleMonth(bills, card, reference) {
  return cycleMonth(closingCycles(bills).get(card.itemId + "/" + card.id), reference, dayNumber(reference));
}

// Mediana recente, em dias, entre fechamento e vencimento das faturas oficiais do cartão.
export function dueGap(bills, card) {
  const gaps = (closingCycles(bills).get(card.itemId + "/" + card.id) ?? []).slice(-RECENT_CYCLES)
    .filter(({ due }) => due !== null).map(({ close, due }) => due - close);
  return gaps.length ? median(gaps) : null;
}

// reference aceita AAAA-MM ou AAAA-MM-DD; o dia identifica faturas oficiais ainda abertas.
export function installmentSchedule(entries, bills, reference) {
  const fromMonth = reference.slice(0, 7);
  const today = dayNumber(reference);
  const billMonths = new Map(bills.map((bill) => [cardKey(bill) + "/" + bill.id, bill.due?.slice(0, 7)]));
  const cycles = closingCycles(bills);
  const schedule = [];
  const plans = new Map();
  for (const entry of entries) {
    const { id, itemId, accountId, amount, currency, installment, installments, description } = entry;
    if (entry.direction !== "DEBIT" || entry.method === "Fatura" ||
        !Number.isInteger(installments) || installments < 2 ||
        !Number.isInteger(installment) || installment < 1 || installment > installments) continue;
    const billKey = cardKey(entry) + "/" + entry.billId;
    // PENDING sem fatura pertence ao ciclo aberto. billForecastDate pode repetir o mês da compra,
    // mas uma previsão posterior ao ciclo aberto indica parcela futura enviada antes da hora.
    const openCycle = entry.status === "PENDING" && !entry.billId;
    const pendingMonth = openCycle
      ? [cycleMonth(cycles.get(cardKey(entry)), entry.date, today), entry.billForecastMonth].filter(isMonth).sort().at(-1)
      : null;
    const month = [
      billMonths.get(billKey), pendingMonth, entry.billForecastMonth, entry.installmentMonth, entry.date?.slice(0, 7),
    ].find(isMonth);
    if (!month) continue;
    const row = {
      id, itemId, accountId, amount, currency, installment, installments, description, month,
      estimated: false, billId: billMonths.has(billKey) ? entry.billId : null,
    };
    if (month >= fromMonth) schedule.push(row);
    if (!entry.installmentPlan) continue;
    const key = cardKey(entry) + "/" + entry.installmentPlan;
    if (!plans.has(key)) plans.set(key, []);
    plans.get(key).push(row);
  }

  for (const [key, rows] of plans) {
    // Two different transactions at the same position could be different purchases.
    if (new Set(rows.map((row) => row.installment)).size !== rows.length) continue;
    const ordered = rows.sort((a, b) => a.installment - b.installment);
    const first = ordered[0];
    if (first.installments > 240) continue;
    let anchor = first;
    let nextIndex = 1;
    for (let installment = first.installment + 1; installment <= first.installments; installment++) {
      const next = ordered[nextIndex];
      if (next?.installment === installment) {
        anchor = next;
        nextIndex++;
        continue;
      }
      const month = addMonths(anchor.month, installment - anchor.installment);
      if (month >= fromMonth && (!next || month < next.month)) {
        schedule.push({ ...anchor, id: "estimate/" + key + "/" + installment, month, installment, estimated: true, billId: null });
      }
    }
  }
  // O provedor pode trocar o identificador do plano entre parcelas. A previsão cede lugar
  // à parcela real do mesmo cartão, mês e posição com valor próximo.
  const position = (row) => [cardKey(row), row.currency, row.month, row.installment, row.installments].join("/");
  const real = new Map();
  for (const row of schedule) if (!row.estimated) real.set(position(row), [...real.get(position(row)) ?? [], row.amount]);
  const near = (a, b) => Math.abs(a - b) <= Math.max(100, 0.05 * Math.max(Math.abs(a), Math.abs(b)));
  const covered = (row) => (real.get(position(row)) ?? []).some((amount) => near(amount, row.amount));
  return schedule.filter((row) => !row.estimated || !covered(row)).sort((a, b) => a.month.localeCompare(b.month) || Number(a.estimated) - Number(b.estimated) ||
    a.description.localeCompare(b.description) || a.installment - b.installment);
}
