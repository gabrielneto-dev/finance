// Chave do estabelecimento ou destinatário a partir da descrição (SPEC-0003, 1.4).
// Agrupa compras do mesmo lugar e serve para recorrências e regras de categoria.

const PREFIXES = [
  /^(DEBITO|COMPRA)\b[A-Z ]*?\d{2}\/\d{2}\s+/, // "DEBITO VISA ELECTRON BRASIL 03/07 BAR"
  /^PIX\s+(AUTOMATICO\s+)?(ENVIADO|RECEBIDO|AGENDADO)\s+/,
  /^(PAGAMENTO|TRANSFERENCIA)\s+(PIX|ENVIADA|RECEBIDA|TED|DOC)\s+/,
  /^(TED|DOC)\s+(ENVIADA|RECEBIDA|ENVIADO|RECEBIDO)\s+/,
  /^COMPRA\s+(NO\s+)?(CARTAO|DEBITO|CREDITO)\s+/,
];
// Intermediadores de pagamento que antecedem o nome real: "MP*MERCADOLIVRE", "IFD*RESTAURANTE".
const GATEWAY = /^(MP|DM|EC|PG|PAG|IFD|IFOOD|PP|PAYPAL|EBANX|EBN|HTM|SHPP|ASSINY|MERCPAGO|PICPAY|PAGSEGURO|SUMUP|STONE|CIELO|GETNET|ZP|ZIG)\s*\*\s*/;
const NOISE = [
  /\bPARC(ELA)?\s*\d{1,2}\s*(\/|DE)\s*\d{1,2}\b/g, // marca de parcela
  /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, // datas
  /\bCNPJ\b/g, /\bCPF\b/g,
  /\d{4,}/g, // documentos e códigos longos
];
const MAX_KEY = 40;

const plain = (/** @type {string} */ text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/**
 * @param {string | null | undefined} description
 * @returns {string}
 */
export function merchantKey(description) {
  let text = plain(String(description ?? "")).replace(/\s+/g, " ").trim();
  for (const prefix of PREFIXES) text = text.replace(prefix, "");
  text = text.replace(GATEWAY, "").replace(/\*/g, " ");
  for (const noise of NOISE) text = text.replace(noise, " ");
  text = text.replace(/[^A-Z0-9&.\- ]/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, MAX_KEY).trim() || "SEM DESCRICAO";
}

const SMALL = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"]);
/** Nome legível a partir da chave: "SUPERMERCADO DA ESQUINA" → "Supermercado da Esquina". */
export function merchantLabel(/** @type {string} */ key) {
  if (key === "SEM DESCRICAO") return "Sem descrição";
  return key.toLowerCase().split(" ").map((word, index) =>
    index > 0 && SMALL.has(word.toUpperCase()) ? word : word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
