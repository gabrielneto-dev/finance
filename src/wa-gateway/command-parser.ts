import { parseAmountToCents } from "../lib/money";

export type ParsedCommand =
  | {
      kind: "transaction";
      type: "EXPENSE" | "INCOME";
      amountCents: number;
      description: string;
      accountHint?: string;
      cardHint?: string;
      categoryHint?: string;
      installments?: number;
      date?: Date;
    }
  | { kind: "confirm" }
  | { kind: "undo" }
  | { kind: "correct"; field: string; value: string }
  | { kind: "balance"; accountHint?: string }
  | { kind: "help" }
  | { kind: "invalid"; reason: string };

const MODIFIER_KEYS: Record<string, string> = {
  conta: "accountHint",
  cartao: "cardHint",
  cart: "cardHint",
  cat: "categoryHint",
  categoria: "categoryHint",
  parcelas: "installments",
  data: "date",
};

function parseBrDate(value: string): Date | undefined {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = match[3]
    ? Number(match[3].length === 2 ? `20${match[3]}` : match[3])
    : new Date().getFullYear();
  return new Date(year, month, day);
}

function parseTransactionCommand(
  type: "EXPENSE" | "INCOME",
  tokens: string[],
): ParsedCommand {
  if (tokens.length < 1) {
    return { kind: "invalid", reason: "Faltou o valor. Ex: /g 45,90 ifood cat:alimentacao" };
  }

  const amountCents = parseAmountToCents(tokens[0]);
  if (amountCents === null || amountCents <= 0) {
    return { kind: "invalid", reason: `Não entendi o valor "${tokens[0]}".` };
  }

  const descriptionParts: string[] = [];
  const modifiers: Record<string, string> = {};

  for (const token of tokens.slice(1)) {
    const separatorIndex = token.indexOf(":");
    if (separatorIndex > 0) {
      const key = token.slice(0, separatorIndex).toLowerCase();
      const value = token.slice(separatorIndex + 1);
      const mapped = MODIFIER_KEYS[key];
      if (mapped) {
        modifiers[mapped] = value;
        continue;
      }
    }
    descriptionParts.push(token);
  }

  const description = descriptionParts.join(" ").trim() || "(sem descrição)";
  const installments = modifiers.installments ? Number(modifiers.installments) : undefined;
  const date = modifiers.date ? parseBrDate(modifiers.date) : undefined;

  return {
    kind: "transaction",
    type,
    amountCents,
    description,
    accountHint: modifiers.accountHint,
    cardHint: modifiers.cardHint,
    categoryHint: modifiers.categoryHint,
    installments: installments && installments > 1 ? installments : undefined,
    date,
  };
}

export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const [rawCommand, ...rest] = trimmed.split(/\s+/);
  const command = rawCommand.toLowerCase();

  switch (command) {
    case "/g":
    case "/gasto":
      return parseTransactionCommand("EXPENSE", rest);
    case "/r":
    case "/receita":
      return parseTransactionCommand("INCOME", rest);
    case "/ok":
    case "/confirmar":
      return { kind: "confirm" };
    case "/desfazer":
    case "/cancelar":
      return { kind: "undo" };
    case "/corrigir": {
      const [field, ...valueParts] = rest;
      if (!field || valueParts.length === 0) {
        return { kind: "invalid", reason: "Uso: /corrigir <campo> <valor>. Campos: valor, descricao, categoria, conta, cartao." };
      }
      return { kind: "correct", field: field.toLowerCase(), value: valueParts.join(" ") };
    }
    case "/saldo":
      return { kind: "balance", accountHint: rest.join(" ") || undefined };
    case "/ajuda":
    case "/help":
      return { kind: "help" };
    default:
      return { kind: "invalid", reason: `Comando "${command}" não reconhecido. Envie /ajuda.` };
  }
}
