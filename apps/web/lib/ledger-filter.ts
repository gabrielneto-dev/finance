export type HourBand = "" | "morning" | "afternoon" | "night" | "unknown";

export interface LedgerFilters {
  account: string;
  method: string;
  hours: string;
}

interface FilterableEntry {
  itemId: string;
  accountId: string;
  method: string | null;
  time: string | null;
}

export const UNKNOWN_METHOD = "Não informada";

const accountKey = (row: FilterableEntry) => row.itemId + "/" + row.accountId;

function hourBand(time: string): HourBand {
  const hour = Number(time.slice(0, 2));
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}

// Lançamentos sem horário ou sem forma continuam visíveis e têm filtros próprios.
export function filterLedger<T extends FilterableEntry>(rows: T[], { account, method, hours }: LedgerFilters): T[] {
  return rows.filter((row) => {
    if (account && accountKey(row) !== account) return false;
    if (method && (row.method ?? UNKNOWN_METHOD) !== method) return false;
    if (!hours) return true;
    return row.time ? hourBand(row.time) === hours : hours === "unknown";
  });
}
