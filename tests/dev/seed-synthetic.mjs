// Banco sintético para testar o app e o backend localmente (SPEC-0005, Marco 1).
// Uma conexão, uma conta corrente com valor bloqueado, um cartão e lançamentos do mês atual. Nada é real.
//   node tests/dev/seed-synthetic.mjs [caminho do banco]   (padrão: apps/web/data/dev-synthetic.sqlite)
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase, writeBatch } from "../../apps/web/lib/db.mjs";

const file = resolve(process.argv[2] || "apps/web/data/dev-synthetic.sqlite");
if (!file.includes("synthetic")) throw new Error("Por segurança, o nome do banco sintético precisa conter 'synthetic'.");
for (const suffix of ["", "-wal", "-shm"]) if (existsSync(file + suffix)) rmSync(file + suffix);

const owner = process.env.MOCK_USER_ID || "5ca1ab1e-0000-4000-8000-000000000001";
const item = "00000000-0000-4000-8000-0000000000a1";
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date());
const month = today.slice(0, 7);
const day = (n) => month + "-" + String(Math.min(n, Number(today.slice(8, 10)))).padStart(2, "0");

const db = openDatabase(file);
db.prepare("INSERT INTO connections(id,owner,name,status,synced_at,baseline,active) VALUES(?,?,?,?,?,?,1)")
  .run(item, owner, "Banco Sintético", "CONECTADA", new Date().toISOString(), "2026-01-01T00:00:00Z");
const accounts = [
  { id: "conta-1", itemId: item, name: "Conta Corrente Teste", type: "BANK", subtype: "CHECKING_ACCOUNT", last4: "0001",
    currency: "BRL", balance: 523_450, closes: null, due: null,
    bank: { closingBalance: 573_450, investedBalance: null, overdraftLimit: 100_000, overdraftUsed: 0, unarrangedOverdraft: null } },
  { id: "cartao-1", itemId: item, name: "Cartão Teste", type: "CREDIT", subtype: "CREDIT_CARD", last4: "4242",
    currency: "BRL", balance: 81_230, closes: null, due: null,
    credit: { brand: "VISA", level: null, status: "ACTIVE", holderType: null, limit: 500_000, availableLimit: 418_770, minimumPayment: null, foreignBalance: null } },
];
const entry = (id, accountId, d, description, direction, amount, method, status = "POSTED") => ({
  id, itemId: item, accountId, description, date: d, time: "10:00", status, direction, amount, currency: "BRL",
  method, category: null, billId: null, installment: null, installments: null,
});
const entries = [
  entry("e1", "conta-1", day(1), "Salário Empresa Fictícia", "CREDIT", 850_000, "TED"),
  entry("e2", "conta-1", day(2), "Pix Recebido Pessoa Teste", "CREDIT", 12_000, "Pix"),
  entry("e3", "conta-1", day(3), "Aluguel Imóvel Teste", "DEBIT", 250_000, "Boleto"),
  entry("e4", "conta-1", day(5), "Mercado Exemplo", "DEBIT", 34_590, "Débito"),
  entry("e5", "conta-1", day(6), "Pix Enviado Pessoa Teste", "DEBIT", 5_000, "Pix"),
  entry("e6", "conta-1", day(7), "Conta de Luz Teste", "DEBIT", 18_900, "Boleto", "PENDING"),
  entry("e7", "cartao-1", day(4), "Restaurante Exemplo", "DEBIT", 8_750, "Crédito"),
];
writeBatch(db, item, accounts, entries, []);
db.close();
console.log("Banco sintético criado em " + file + " para o dono " + owner);
