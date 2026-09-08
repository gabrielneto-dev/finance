import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export interface LlmParsedTransaction {
  type: "EXPENSE" | "INCOME";
  amountCents: number;
  description: string;
  accountHint?: string;
  cardHint?: string;
  categoryHint?: string;
  installments?: number;
  confidence: number;
}

const REGISTER_TRANSACTION_TOOL = {
  name: "register_transaction",
  description:
    "Extrai os dados estruturados de uma transação financeira mencionada em uma mensagem informal em português.",
  input_schema: {
    type: "object" as const,
    properties: {
      type: {
        type: "string",
        enum: ["EXPENSE", "INCOME"],
        description: "EXPENSE para gasto/compra/pagamento, INCOME para recebimento/salário/venda.",
      },
      amount: { type: "number", description: "Valor em reais (não em centavos), ex: 45.90" },
      description: {
        type: "string",
        description: "Descrição curta do que foi a transação, ex: 'ifood', 'mercado', 'uber'.",
      },
      account_hint: {
        type: "string",
        description: "Apelido/nome da conta mencionada, se houver (ex: 'nubank', 'carteira').",
      },
      card_hint: {
        type: "string",
        description: "Apelido/nome do cartão de crédito mencionado, se houver.",
      },
      category_hint: {
        type: "string",
        description:
          "Categoria provável (ex: 'alimentação', 'transporte', 'lazer'), inferida mesmo se não mencionada.",
      },
      installments: {
        type: "integer",
        description: "Número de parcelas, se a mensagem mencionar parcelamento. Omitir se à vista.",
      },
      confidence: {
        type: "number",
        description:
          "Confiança de 0 a 1 na extração. Use valor abaixo de 0.6 se a mensagem for ambígua ou faltar o valor.",
      },
    },
    required: ["type", "amount", "description", "confidence"],
  },
};

export async function parseWithLlm(text: string): Promise<LlmParsedTransaction | null> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system:
      "Você extrai dados de transações financeiras de mensagens informais em português do Brasil, " +
      "enviadas por uma pessoa registrando seus próprios gastos e receitas via WhatsApp. " +
      "Sempre chame a ferramenta register_transaction. Se a mensagem não descrever uma transação " +
      "financeira, chame a ferramenta mesmo assim com confidence 0.",
    tools: [REGISTER_TRANSACTION_TOOL],
    tool_choice: { type: "tool", name: "register_transaction" },
    messages: [{ role: "user", content: text }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) return null;

  const input = toolUse.input as {
    type: "EXPENSE" | "INCOME";
    amount: number;
    description: string;
    account_hint?: string;
    card_hint?: string;
    category_hint?: string;
    installments?: number;
    confidence: number;
  };

  return {
    type: input.type,
    amountCents: Math.round(input.amount * 100),
    description: input.description,
    accountHint: input.account_hint,
    cardHint: input.card_hint,
    categoryHint: input.category_hint,
    installments: input.installments && input.installments > 1 ? input.installments : undefined,
    confidence: input.confidence,
  };
}
