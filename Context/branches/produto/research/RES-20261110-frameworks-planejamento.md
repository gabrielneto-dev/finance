---
id: "CTX-RES-20261110-frameworks-planejamento"
type: "research"
title: "Frameworks de planejamento para renda mista: CLT, revenda e investimentos"
branch: "produto"
tags: ["escopo", "pluggy"]
status: "active"
created_at: "2026-11-10"
updated_at: "2026-11-10"
confidence: "medium"
source_ids: []
related: ["CTX-DEC-20261110-planejamento", "CTX-DEC-20261110-classificacao-analises"]
---

# Frameworks de planejamento para renda mista: CLT, revenda e investimentos

**Pergunta.** Que métodos de finanças pessoais servem a quem tem salário CLT, compra e vende pelas mesmas contas e quer investir no longo prazo? Como transformá-los em caixinhas, metas e projeções no Finance?

**Método.** Busca na web em 2026-11-10, preferindo o site do autor ou a documentação oficial. Resultados de sites gerados automaticamente foram descartados.

## Achados

- **Plano Consciente (Ramit Sethi).** Divide o líquido em quatro fatias. As faixas aparecem no site do autor e na [NerdWallet](https://www.nerdwallet.com/finance/learn/glowup-with-ramit):
  - custos fixos, 50–60%;
  - investimentos, cerca de 10% (algumas fontes dizem 5–10%);
  - poupança para objetivos, 5–10%;
  - gasto livre sem culpa, 20–35%.

  Fontes: [iwillteachyoutoberich.com/conscious-spending](https://www.iwillteachyoutoberich.com/conscious-spending), [Motley Fool](https://fool.com/the-ascent/personal-finance/articles/heres-how-much-of-your-income-should-go-toward-necessities-according-to-ramit-sethi/).
- **YNAB (base zero).** As quatro regras:
  - dar uma função a cada real;
  - assumir as despesas verdadeiras, guardando aos poucos para gastos anuais;
  - se adaptar remanejando entre categorias;
  - envelhecer o dinheiro.

  Fonte: [ynab.com/ynab-four-rules-budgeting](https://www.ynab.com/ynab-four-rules-budgeting).
- **Profit First (Mike Michalowicz).** Para negócios. A receita real é dividida em lucro, pagamento do dono, impostos e despesas operacionais, começando pelos percentuais atuais e caminhando aos poucos até os alvos. O lucro inicial sugerido é de 5–10%. Os alvos variam por setor. Fonte: [mikemichalowicz.com](https://mikemichalowicz.com/mastering-profit-first-master-your-percentage-allocations/).
- **Reserva de emergência no Brasil.** O cálculo é gasto essencial × meses, com liquidez diária e sem renda variável:
  - 3 a 6 meses para CLT;
  - 6 a 12 meses para autônomo ou renda variável;
  - mais um mês por dependente.

  Fontes: [valorfinal.com.br](https://valorfinal.com.br/cursos/gestao-financeira-pessoal/reserva-de-emergencia-e-protecao/reserva-clt-autonomo-renda-variavel), [TradeMap](https://trademap.com.br/calculadoras/reserva-emergencia).
- **Investimentos pela Pluggy.**
  - `GET /investments?itemId=` lista as aplicações com `balance` líquido, `amount` bruto, tipo e campos de renda fixa. As movimentações ficam em `GET /investments/{id}/transactions`.
  - O Rico aparece na cobertura de investimentos do Open Finance.
  - O conector MeuPluggy da conexão atual oferece `INVESTMENTS` e `INVESTMENTS_TRANSACTIONS`, mas o Item foi criado sem esses produtos.

  Fontes: [docs.pluggy.ai/en/docs/products/investments](https://docs.pluggy.ai/en/docs/products/investments), [cobertura de investimentos](https://docs.pluggy.ai/docs/investments-open-finance-coverage).

## Síntese aplicada ao Finance

- O Plano Consciente define as caixinhas iniciais e as faixas saudáveis.
- O YNAB entra como a renda sem destino, que precisa chegar a zero, e como o acúmulo opcional por caixinha.
- O Profit First, adaptado à revenda, separa o lucro do negócio da vida pessoal e sugere quanto de cada venda vai para reposição, impostos e taxas, lucro e retirada.
- A reserva padrão é de 6 meses de gasto essencial, porque a renda mistura CLT com revenda.
- A regra dos 4%, ou 25× o gasto anual, entra como meta opcional de independência financeira.

## Limites

- As faixas são referências de planejamento, não regras oficiais.
- A tabela oficial de percentuais por faixa de receita do Profit First não foi encontrada. O Finance parte dos percentuais reais atuais.
- Falta confirmar se o Rico do usuário está conectado no Meu Pluggy e se `/investments` devolve dados nesse Item (SPEC-0004-T012).
