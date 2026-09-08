import "dotenv/config";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcodeTerminal from "qrcode-terminal";
import pino from "pino";
import { isSenderAllowed } from "./allowlist";
import { parseCommand } from "./command-parser";
import { parseWithLlm } from "./llm-parser";
import * as api from "./api-client";
import * as replies from "./replies";
import { parseAmountToCents } from "../lib/money";

const SESSION_PATH = process.env.WA_SESSION_PATH ?? "./data/wa-session";
const LLM_CONFIDENCE_THRESHOLD = Number(process.env.LLM_CONFIDENCE_THRESHOLD ?? 0.6);
const logger = pino({ level: process.env.WA_LOG_LEVEL ?? "warn" });

const CORRECTION_FIELD_MAP: Record<string, string> = {
  valor: "amountCents",
  descricao: "description",
  categoria: "categoryHint",
  conta: "accountHint",
  cartao: "cardHint",
};

async function handleTransaction(
  jid: string,
  input: {
    type: "EXPENSE" | "INCOME";
    amountCents: number;
    description: string;
    accountHint?: string;
    cardHint?: string;
    categoryHint?: string;
    installments?: number;
    date?: Date;
    status: "PENDING" | "CONFIRMED";
    sourceMessageId?: string;
  },
  sendReply: (text: string) => Promise<void>,
): Promise<void> {
  const result = await api.createTransaction({
    description: input.description,
    amountCents: input.amountCents,
    type: input.type,
    date: input.date?.toISOString(),
    accountHint: input.accountHint,
    cardHint: input.cardHint,
    categoryHint: input.categoryHint,
    installments: input.installments,
    origin: "WHATSAPP",
    status: input.status,
    sourceMessageId: input.sourceMessageId,
  });

  if (!result.ok) {
    const message =
      typeof result.data === "object" && result.data && "error" in result.data
        ? String((result.data as Record<string, unknown>).error)
        : "Erro ao registrar transação.";
    await sendReply(replies.genericError(message));
    return;
  }

  await sendReply(
    replies.transactionConfirmed({
      type: input.type,
      amountCents: input.amountCents,
      description: input.description,
      categoryName: input.categoryHint,
      originName: input.accountHint ?? input.cardHint,
      installments: input.installments,
      pending: input.status === "PENDING",
    }),
  );
}

async function handleText(jid: string, text: string, sendReply: (text: string) => Promise<void>) {
  const command = parseCommand(text);

  if (command) {
    switch (command.kind) {
      case "transaction": {
        const { kind: _kind, ...transactionInput } = command;
        await handleTransaction(jid, { ...transactionInput, status: "CONFIRMED" }, sendReply);
        return;
      }
      case "confirm": {
        const result = await api.confirmLastTransaction();
        await sendReply(
          result.ok ? "✅ Transação confirmada." : replies.genericError("Nada para confirmar."),
        );
        return;
      }
      case "undo": {
        const last = await api.getLastTransaction();
        if (!last.ok) {
          await sendReply(replies.nothingToUndo());
          return;
        }
        await api.deleteTransaction((last.data as { id: string }).id);
        await sendReply(replies.undoConfirmed());
        return;
      }
      case "correct": {
        const mappedField = CORRECTION_FIELD_MAP[command.field];
        if (!mappedField) {
          await sendReply(
            replies.invalidCommand(
              `Campo "${command.field}" desconhecido. Use: valor, descricao, categoria, conta, cartao.`,
            ),
          );
          return;
        }
        const last = await api.getLastTransaction();
        if (!last.ok) {
          await sendReply(replies.nothingToUndo());
          return;
        }
        const patch: Record<string, unknown> = {};
        if (mappedField === "amountCents") {
          const cents = parseAmountToCents(command.value);
          if (cents === null) {
            await sendReply(replies.invalidCommand(`Não entendi o valor "${command.value}".`));
            return;
          }
          patch.amountCents = cents;
        } else {
          patch[mappedField] = command.value;
        }
        const result = await api.updateTransaction((last.data as { id: string }).id, patch);
        if (!result.ok) {
          const message =
            typeof result.data === "object" && result.data && "error" in result.data
              ? String((result.data as Record<string, unknown>).error)
              : "Erro ao corrigir.";
          await sendReply(replies.genericError(message));
          return;
        }
        await sendReply(replies.correctionApplied(command.field));
        return;
      }
      case "balance": {
        const accounts = await api.listAccounts();
        if (!accounts.ok || accounts.data.length === 0) {
          await sendReply(replies.genericError("Nenhuma conta cadastrada."));
          return;
        }
        const target = command.accountHint
          ? accounts.data.find((a) =>
              a.name.toLowerCase().includes(command.accountHint!.toLowerCase()),
            )
          : accounts.data[0];
        if (!target) {
          await sendReply(replies.genericError(`Conta "${command.accountHint}" não encontrada.`));
          return;
        }
        const balance = await api.getAccountBalance(target.id);
        if (!balance.ok) {
          await sendReply(replies.genericError("Erro ao consultar saldo."));
          return;
        }
        await sendReply(replies.balanceReply(target.name, balance.data.balanceCents));
        return;
      }
      case "help":
        await sendReply(replies.helpText());
        return;
      case "invalid":
        await sendReply(replies.invalidCommand(command.reason));
        return;
    }
  }

  const llmResult = await parseWithLlm(text);
  if (!llmResult || llmResult.confidence <= 0) {
    await sendReply(replies.unrecognizedMessage());
    return;
  }

  await handleTransaction(
    jid,
    {
      type: llmResult.type,
      amountCents: llmResult.amountCents,
      description: llmResult.description,
      accountHint: llmResult.accountHint,
      cardHint: llmResult.cardHint,
      categoryHint: llmResult.categoryHint,
      installments: llmResult.installments,
      status: llmResult.confidence >= LLM_CONFIDENCE_THRESHOLD ? "CONFIRMED" : "PENDING",
    },
    sendReply,
  );
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

  const sock = makeWASocket({
    auth: state,
    logger,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcodeTerminal.generate(qr, { small: true });
      console.log("Escaneie o QR code acima com o WhatsApp do número dedicado ao bot.");
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("Conexão encerrada.", { statusCode, shouldReconnect });
      if (shouldReconnect) {
        start();
      } else {
        console.log("Sessão deslogada. Apague a pasta de sessão e escaneie o QR novamente.");
      }
    } else if (connection === "open") {
      console.log("wa-gateway conectado.");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    if (m.type !== "notify") return;

    for (const msg of m.messages) {
      if (msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || !isSenderAllowed(jid)) continue;

      const text =
        msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? "";
      if (!text.trim()) continue;

      try {
        await handleText(jid, text, async (reply) => {
          await sock.sendMessage(jid, { text: reply });
        });
      } catch (error) {
        console.error("Erro ao processar mensagem:", error);
        await sock.sendMessage(jid, {
          text: replies.genericError("Erro interno ao processar sua mensagem."),
        });
      }
    }
  });
}

start().catch((error) => {
  console.error("Falha ao iniciar wa-gateway:", error);
  process.exit(1);
});
