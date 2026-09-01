export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToAmount(cents: number): number {
  return cents / 100;
}
