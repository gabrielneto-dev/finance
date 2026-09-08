export function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let normalized: string;
  if (trimmed.includes(",")) {
    // Formato BR: ponto é separador de milhar, vírgula é decimal ("1.234,56").
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (trimmed.includes(".")) {
    const lastDot = trimmed.lastIndexOf(".");
    const dotCount = trimmed.split(".").length - 1;
    const digitsAfterLastDot = trimmed.length - lastDot - 1;
    // Um único ponto com até 2 dígitos depois é decimal ("45.90").
    // Mais de um ponto, ou 3+ dígitos depois, é separador de milhar ("1.234").
    normalized = dotCount === 1 && digitsAfterLastDot <= 2 ? trimmed : trimmed.replace(/\./g, "");
  } else {
    normalized = trimmed;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function splitEvenly(totalCents: number, parts: number): number[] {
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) =>
    i === parts - 1 ? base + remainder : base,
  );
}
