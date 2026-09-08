import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";

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

interface RawExtraction {
  type: "EXPENSE" | "INCOME";
  amount: number;
  description: string;
  account_hint?: string;
  card_hint?: string;
  category_hint?: string;
  installments?: number;
  confidence: number;
}

const TOOL_NAME = "register_transaction";

const TOOL_DESCRIPTION =
  "Extrai os dados estruturados de uma transação financeira mencionada em uma mensagem informal em português.";

const TOOL_PARAMETERS = {
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
};

const SYSTEM_PROMPT =
  "Você extrai dados de transações financeiras de mensagens informais em português do Brasil, " +
  "enviadas por uma pessoa registrando seus próprios gastos e receitas via WhatsApp. " +
  `Sempre chame a ferramenta ${TOOL_NAME}. Se a mensagem não descrever uma transação ` +
  "financeira, chame a ferramenta mesmo assim com confidence 0.";

function toLlmParsedTransaction(input: RawExtraction): LlmParsedTransaction {
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

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

let anthropicClient: Anthropic | undefined;
function getAnthropicClient(): Anthropic {
  anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

async function parseWithAnthropic(text: string): Promise<LlmParsedTransaction | null> {
  const response = await getAnthropicClient().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: [{ name: TOOL_NAME, description: TOOL_DESCRIPTION, input_schema: TOOL_PARAMETERS }],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: text }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) return null;

  return toLlmParsedTransaction(toolUse.input as RawExtraction);
}

const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";

let groqClient: Groq | undefined;
function getGroqClient(): Groq {
  groqClient ??= new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

async function parseWithGroq(text: string): Promise<LlmParsedTransaction | null> {
  const response = await getGroqClient().chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    tools: [
      {
        type: "function",
        function: { name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters: TOOL_PARAMETERS },
      },
    ],
    tool_choice: { type: "function", function: { name: TOOL_NAME } },
  });

  const toolCall = response.choices[0]?.message.tool_calls?.[0];
  if (!toolCall) return null;

  return toLlmParsedTransaction(JSON.parse(toolCall.function.arguments) as RawExtraction);
}

const PROVIDER = process.env.LLM_PROVIDER === "groq" ? "groq" : "anthropic";

export async function parseWithLlm(text: string): Promise<LlmParsedTransaction | null> {
  return PROVIDER === "groq" ? parseWithGroq(text) : parseWithAnthropic(text);
}
