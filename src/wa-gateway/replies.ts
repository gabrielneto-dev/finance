import { centsToBRL } from "../lib/money";

const TYPE_LABEL: Record<string, string> = { EXPENSE: "Gasto", INCOME: "Receita" };

export function transactionConfirmed(params: {
  type: "EXPENSE" | "INCOME";
  amountCents: number;
  description: string;
  categoryName?: string;
  originName?: string;
  installments?: number;
  pending: boolean;
}): string {
  const parts = [
    `${params.pending ? "🕓" : "✅"} ${TYPE_LABEL[params.type]} · ${centsToBRL(params.amountCents)}`,
    params.description,
  ];
  if (params.categoryName) parts.push(params.categoryName);
  if (params.originName) parts.push(params.originName);
  if (params.installments) parts.push(`${params.installments}x`);

  const header = parts.join(" · ");
  if (params.pending) {
    return `${header}\n\nBaixa confiança na leitura. Responda /ok para confirmar, /corrigir <campo> <valor>, ou /desfazer para cancelar.`;
  }
  return `${header}\n\nResponda /corrigir <campo> <valor> ou /desfazer se algo estiver errado.`;
}

export function invalidCommand(reason: string): string {
  return `⚠️ ${reason}`;
}

export function genericError(message: string): string {
  return `❌ ${message}`;
}

export function undoConfirmed(): string {
  return "🗑️ Última transação removida.";
}

export function nothingToUndo(): string {
  return "Não há transação recente para desfazer.";
}

export function correctionApplied(field: string): string {
  return `✏️ Campo "${field}" atualizado.`;
}

export function balanceReply(accountName: string, balanceCents: number): string {
  return `💰 ${accountName}: ${centsToBRL(balanceCents)}`;
}

export function helpText(): string {
  return [
    "*Comandos disponíveis*",
    "/g <valor> <descrição> [conta:x] [cartao:x] [cat:x] [parcelas:n] [data:dd/mm] — registrar gasto",
    "/r <valor> <descrição> [conta:x] [cat:x] [data:dd/mm] — registrar receita",
    "/ok — confirmar a última transação pendente",
    "/corrigir <campo> <valor> — editar a última transação (campos: valor, descricao, categoria, conta, cartao)",
    "/desfazer — remover a última transação",
    "/saldo [conta] — consultar saldo",
    "",
    "Também entendo frases livres, tipo: \"gastei 45 no ifood no crédito do nubank\".",
  ].join("\n");
}

export function unrecognizedMessage(): string {
  return "Não consegui entender essa mensagem como um gasto ou receita. Envie /ajuda para ver os comandos.";
}
