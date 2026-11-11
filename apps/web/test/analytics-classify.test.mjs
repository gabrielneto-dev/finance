import assert from "node:assert/strict";
import test from "node:test";
import { categoryById, isChoice, pluggyCategory } from "../lib/analytics/categories.mjs";
import { BUSINESS_KINDS, businessValue, choiceFor, classify, entryKey, INCOME_KINDS, SPENDING_KINDS, spendingValue } from "../lib/analytics/classify.mjs";
import { merchantKey, merchantLabel } from "../lib/analytics/merchant.mjs";

const entry = (extra = {}) => ({
  id: "e1", itemId: "i1", accountId: "a1", description: "Compra sintética", date: "2026-10-05", time: null,
  status: "POSTED", direction: "DEBIT", amount: 1000, currency: "BRL", method: null, category: "Groceries",
  billId: null, installment: null, installments: null, ...extra,
});

test("despesa comum recebe categoria, grupo e natureza em português", () => {
  const row = classify(entry());
  assert.equal(row.kind, "despesa");
  assert.equal(row.label, "Mercado");
  assert.equal(row.groupLabel, "Mercado e casa");
  assert.equal(row.nature, "essencial");
  assert.equal(spendingValue(row), 1000);
});

test("pagamento de fatura fica fora pelo método ou pela categoria, na conta e no cartão", () => {
  for (const [extra, accountType] of [
    [{ method: "Fatura", category: null }, "BANK"],
    [{ method: "Cartão", category: "Credit card payment" }, "BANK"],
    [{ direction: "CREDIT", method: "Crédito", category: "Credit card payment" }, "CREDIT"],
  ]) {
    const row = classify(entry(extra), { accountType });
    assert.equal(row.kind, "pagamento_fatura");
    assert.equal(spendingValue(row), 0);
  }
});

test("transferência entre contas próprias, investimento e empréstimo são neutros", () => {
  assert.equal(classify(entry({ category: "Same person transfer" })).kind, "transferencia_propria");
  assert.equal(classify(entry({ category: "Same person transfer - CASH" })).kind, "transferencia_propria");
  assert.equal(classify(entry({ direction: "CREDIT", category: "Transfer - Internal" })).kind, "transferencia_propria");
  assert.equal(classify(entry({ category: "Fixed income" })).kind, "investimento");
  assert.equal(classify(entry({ direction: "CREDIT", category: "Loans and financing" })).kind, "emprestimo");
});

test("crédito de consumo vira estorno e abate a despesa da mesma categoria", () => {
  const card = classify(entry({ direction: "CREDIT", category: "Clothing" }), { accountType: "CREDIT" });
  assert.equal(card.kind, "estorno");
  assert.equal(card.label, "Roupas");
  assert.equal(spendingValue(card), -1000);
  // No cartão, crédito que não é pagamento é estorno mesmo sem categoria de consumo.
  assert.equal(classify(entry({ direction: "CREDIT", category: null }), { accountType: "CREDIT" }).kind, "estorno");
  assert.equal(classify(entry({ direction: "CREDIT", category: "Transfer - PIX" }), { accountType: "CREDIT" }).kind, "estorno");
  // Na conta, compra devolvida também é estorno.
  assert.equal(classify(entry({ direction: "CREDIT", category: "Shopping" })).kind, "estorno");
});

test("entradas na conta viram receita e rendimento separados", () => {
  assert.equal(classify(entry({ direction: "CREDIT", category: "Salary" })).label, "Salário");
  assert.equal(classify(entry({ direction: "CREDIT", category: "Proceeds interests and dividends" })).kind, "rendimento");
  const pix = classify(entry({ direction: "CREDIT", category: "Transfer - PIX" }));
  assert.equal(pix.kind, "receita");
  assert.equal(pix.label, "Pix e transferências recebidas");
  assert.equal(classify(entry({ direction: "CREDIT", category: null })).label, "Outras entradas");
});

test("Pix enviado sem escolha do usuário fica no grupo de terceiros", () => {
  const row = classify(entry({ category: "Transfer - PIX", method: "Pix" }));
  assert.equal(row.kind, "despesa");
  assert.equal(row.group, "terceiros");
  assert.equal(row.nature, null);
});

test("categoria desconhecida cai em Sem categoria e mantém o nome original", () => {
  const row = classify(entry({ category: "Categoria nova da Pluggy" }));
  assert.equal(row.group, "outros");
  assert.equal(row.category, "sem");
  assert.equal(row.label, "Categoria nova da Pluggy");
  assert.equal(classify(entry({ category: null })).label, "Sem categoria");
});

test("compra em outra moeda usa o valor cobrado em reais", () => {
  const row = classify(entry({ amount: 1000, currency: "USD", accountAmount: 5530, accountCurrency: "BRL" }));
  assert.deepEqual([row.amount, row.currency], [5530, "BRL"]);
});

test("escolha do usuário vence a Pluggy, e a do lançamento vence a do estabelecimento", () => {
  const pix = entry({ category: "Transfer - PIX", description: "PIX ENVIADO   Pessoa Sintetica" });
  const choices = { entries: new Map(), rules: new Map([[merchantKey(pix.description), "delivery"]]) };
  let choice = choiceFor(pix, choices);
  assert.deepEqual(choice, { value: "delivery", source: "estabelecimento" });
  assert.equal(classify(pix, { choice }).label, "Delivery");

  choices.entries.set(entryKey(pix), "academia");
  choice = choiceFor(pix, choices);
  assert.equal(classify(pix, { choice }).label, "Academia e bem-estar");
  assert.equal(classify(pix, { choice }).source, "lancamento");

  // Escolhas especiais e escolha sobre um lançamento neutro.
  assert.equal(classify(pix, { choice: { value: "ignorar", source: "lancamento" } }).kind, "ignorado");
  assert.equal(classify(pix, { choice: { value: "propria", source: "lancamento" } }).kind, "transferencia_propria");
  const same = entry({ category: "Same person transfer" });
  assert.equal(classify(same, { choice: { value: "pix", source: "lancamento" } }).kind, "despesa");
  assert.equal(choiceFor(pix, null), null);
});

test("valida as escolhas aceitas e o mapa da Pluggy", () => {
  assert.equal(isChoice("mercado"), true);
  assert.equal(isChoice("ignorar"), true);
  assert.equal(isChoice("qualquer"), false);
  assert.equal(isChoice(42), false);
  assert.equal(pluggyCategory("Shopping", "CREDIT"), "compras");
  assert.equal(pluggyCategory(null, "DEBIT"), null);
  assert.equal(categoryById("inexistente"), null);
});

test("normaliza a descrição na chave do estabelecimento", () => {
  assert.equal(merchantKey("DEBITO VISA ELECTRON BRASIL   03/07 BAR ESPETARIA"), "BAR ESPETARIA");
  assert.equal(merchantKey("MP*MERCADOLIVRE"), "MERCADOLIVRE");
  assert.equal(merchantKey("DM*Spotify"), "SPOTIFY");
  assert.equal(merchantKey("PIX ENVIADO   Pessoa Sintética"), "PESSOA SINTETICA");
  assert.equal(merchantKey("PIX AUTOMATICO ENVIADO   iFood"), "IFOOD");
  assert.equal(merchantKey("LOJA EXEMPLO PARC 02/10"), "LOJA EXEMPLO");
  assert.equal(merchantKey("SALARIO CNPJ 12345678000199"), "SALARIO");
  assert.equal(merchantKey("SERVICO* ASSINATURA"), "SERVICO ASSINATURA");
  assert.equal(merchantKey(""), "SEM DESCRICAO");
  assert.equal(merchantLabel("SUPERMERCADO DA ESQUINA"), "Supermercado da Esquina");
  assert.equal(merchantLabel("SEM DESCRICAO"), "Sem descrição");
});

test("categorias de negócio separam vendas e custos, e o estorno de custo abate (SPEC-0004)", () => {
  const sale = classify(entry({ direction: "CREDIT", category: "Transfer - PIX" }), { choice: { value: "negocio_vendas", source: "lancamento" } });
  assert.equal(sale.kind, "negocio_receita");
  assert.equal(sale.groupLabel, "Negócio");
  assert.equal(businessValue(sale), 1000);
  assert.equal(spendingValue(sale), 0);
  const cost = classify(entry({ category: "Shopping" }), { choice: { value: "negocio_mercadoria", source: "estabelecimento" } });
  assert.equal(cost.kind, "negocio_custo");
  assert.equal(cost.label, "Compra de mercadoria");
  assert.equal(businessValue(cost), 1000);
  const refund = classify(entry({ direction: "CREDIT" }), { accountType: "CREDIT", choice: { value: "negocio_frete", source: "lancamento" } });
  assert.equal(refund.kind, "negocio_custo");
  assert.equal(businessValue(refund), -1000);
  assert.equal(SPENDING_KINDS.has(cost.kind) || INCOME_KINDS.has(sale.kind), false);
});

test("conta do negócio vende pelos créditos, gasta pelos débitos e mantém neutros e escolhas", () => {
  assert.equal(classify(entry({ direction: "CREDIT", category: "Salary" }), { business: true }).kind, "negocio_receita");
  const debit = classify(entry({ category: "Groceries" }), { business: true });
  assert.deepEqual([debit.kind, debit.category], ["negocio_custo", "negocio_outros"]);
  const cardCredit = classify(entry({ direction: "CREDIT", category: "Shopping" }), { business: true, accountType: "CREDIT" });
  assert.deepEqual([cardCredit.kind, cardCredit.refund], ["negocio_custo", true]);
  assert.equal(classify(entry({ category: "Credit card payment" }), { business: true }).kind, "pagamento_fatura");
  const own = classify(entry({ category: "Same person transfer" }), { business: true });
  assert.deepEqual([own.kind, own.withdrawal], ["transferencia_propria", true]);
  assert.equal(classify(entry({ category: "Same person transfer" })).withdrawal, undefined);
  assert.equal(classify(entry(), { business: true, choice: { value: "mercado", source: "lancamento" } }).kind, "despesa");
});

test("aporte em investimento e retirada do negócio são escolhas neutras com nome próprio", () => {
  const deposit = classify(entry({ category: "Transfer - PIX" }), { choice: { value: "aporte", source: "lancamento" } });
  assert.deepEqual([deposit.kind, deposit.label], ["investimento", "Aporte em investimento"]);
  const withdrawal = classify(entry({ category: "Transfer - PIX" }), { choice: { value: "retirada", source: "lancamento" } });
  assert.deepEqual([withdrawal.kind, withdrawal.label, withdrawal.withdrawal], ["transferencia_propria", "Retirada do negócio", true]);
  assert.equal(isChoice("aporte"), true);
  assert.equal(isChoice("negocio_vendas"), true);
  assert.equal(BUSINESS_KINDS.has("negocio_custo"), true);
});
