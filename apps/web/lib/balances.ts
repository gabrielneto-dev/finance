type BankBalance = {
  id: string; itemId: string; balance: number | null; currency: string;
  bank?: { closingBalance: number | null } | null;
};
type Deposit = {
  id: string; itemId: string; accountId: string; description: string; category: string | null;
  date: string; time: string | null; direction: "CREDIT" | "DEBIT"; amount: number; currency: string;
};

const DEPOSIT_WINDOW_DAYS = 7;
const isCheque = (row: Deposit) => row.category === "Transfer - Check" || /cheque/i.test(row.description);

// Saldo contábil acima do disponível indica valor bloqueado, como cheque a compensar (REQ-017).
function blockedAmount(row: BankBalance) {
  const closing = row.bank?.closingBalance;
  return row.balance == null || closing == null || closing <= row.balance ? 0 : closing - row.balance;
}

export function blockedBalances(accounts: BankBalance[]) {
  const blocked: { amount: number; currency: string }[] = [];
  const ledger: { amount: number; currency: string }[] = [];
  for (const row of accounts) {
    const amount = blockedAmount(row);
    if (!amount) continue;
    blocked.push({ amount, currency: row.currency });
    ledger.push({ amount: row.bank!.closingBalance!, currency: row.currency });
  }
  return { blocked, ledger };
}

function daysBefore(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

// A Pluggy não informa bloqueio por lançamento. Atribui o valor bloqueado aos cheques recentes,
// do mais novo ao mais antigo, enquanto couberem (REQ-018).
export function blockedDeposits(accounts: BankBalance[], entries: Deposit[], reference: string) {
  const keys = new Set<string>();
  const since = daysBefore(reference, DEPOSIT_WINDOW_DAYS);
  for (const account of accounts) {
    let remaining = blockedAmount(account);
    if (!remaining) continue;
    const deposits = entries.filter((row) => row.itemId === account.itemId && row.accountId === account.id &&
      row.direction === "CREDIT" && row.currency === account.currency && row.date >= since && row.date <= reference && isCheque(row))
      .sort((a, b) => (b.date + (b.time ?? "")).localeCompare(a.date + (a.time ?? "")));
    for (const row of deposits) {
      if (row.amount > remaining) break;
      keys.add(row.itemId + "/" + row.accountId + "/" + row.id);
      remaining -= row.amount;
    }
  }
  return keys;
}
