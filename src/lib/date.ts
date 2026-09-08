export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function addByFrequency(
  date: Date,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
  interval: number,
): Date {
  const result = new Date(date);
  switch (frequency) {
    case "DAILY":
      result.setDate(result.getDate() + interval);
      break;
    case "WEEKLY":
      result.setDate(result.getDate() + interval * 7);
      break;
    case "MONTHLY":
      result.setMonth(result.getMonth() + interval);
      break;
    case "YEARLY":
      result.setFullYear(result.getFullYear() + interval);
      break;
  }
  return result;
}

export function referenceMonthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export interface InvoicePeriod {
  referenceMonth: string;
  closingDate: Date;
  dueDate: Date;
}

export function resolveInvoicePeriod(
  txDate: Date,
  closingDay: number,
  dueDay: number,
): InvoicePeriod {
  const cycleMonthOffset = txDate.getDate() > closingDay ? 1 : 0;
  const closingDate = new Date(
    txDate.getFullYear(),
    txDate.getMonth() + cycleMonthOffset,
    closingDay,
  );
  const dueDate = new Date(
    closingDate.getFullYear(),
    closingDate.getMonth() + 1,
    dueDay,
  );
  return {
    referenceMonth: referenceMonthOf(closingDate),
    closingDate,
    dueDate,
  };
}
