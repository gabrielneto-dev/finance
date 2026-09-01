export function invoiceReferenceFor(date: Date, closingDay: number): Date {
  const reference = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  if (date.getUTCDate() > closingDay) reference.setUTCMonth(reference.getUTCMonth() + 1);
  return reference;
}

export function nextRecurringDate(date: Date, frequency: string): Date {
  const next = new Date(date);
  if (frequency === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
  if (frequency === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  if (frequency === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1);
  if (frequency === "YEARLY") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

export function monthlyInstallmentDate(firstDate: Date, installmentNumber: number): Date {
  const year = firstDate.getUTCFullYear();
  const month = firstDate.getUTCMonth() + installmentNumber - 1;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(firstDate.getUTCDate(), lastDay)));
}

export function splitInstallmentAmount(totalAmount: number, installments: number): number[] {
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainder = totalCents % installments;
  return Array.from({ length: installments }, (_, index) => (baseCents + (index < remainder ? 1 : 0)) / 100);
}
