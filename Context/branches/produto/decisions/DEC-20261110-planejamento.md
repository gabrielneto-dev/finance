---
id: "CTX-DEC-20261110-planejamento"
type: "decision"
title: "Modelo do Planejamento: caixinhas, negócio separado e investimentos"
branch: "produto"
tags: ["escopo", "pluggy"]
status: "active"
created_at: "2026-11-10"
updated_at: "2026-11-10"
source_ids: []
related: ["CTX-RES-20261110-frameworks-planejamento", "CTX-DEC-20261110-classificacao-analises", "CTX-DEC-20261109-sem-avisos-de-atraso"]
---

# Modelo do Planejamento: caixinhas, negócio separado e investimentos

**Contexto.** O usuário pediu uma sessão de planejamento com caixinhas, metas, projeções editáveis, tendências e investimentos. Ele tem salário CLT e faz compra e venda pelas mesmas contas.

**Decisões do usuário (2026-11-10).**
- **Negócio.** Hoje fica misturado nas contas pessoais. O Finance o separa pelos lançamentos marcados com as categorias de Negócio. O usuário pretende ter uma conta só do negócio, por isso também haverá a marcação de conta do negócio.
- **Investimentos.** Lançamento manual e importação pela Pluggy, com Rico e outros apps. Ele foca no longo prazo, em ações, fundos e similares. A tela não pode depender da Pluggy.
- **Divisão inicial.** Plano Consciente, ajustável depois.
- **Sobra do mês.** Cada caixinha escolhe se acumula ou zera.
- **Execução.** O plano foi registrado em 2026-11-10 para continuar em outra sessão.

**Consequências.**
- A classificação da [SPEC-0003](../../../../Specs/features/SPEC-0003--analises/spec.md) ganha os tipos de negócio. Venda e custo saem das receitas e despesas pessoais, e o lucro entra no resultado.
- A situação das caixinhas aparece dentro delas, com ícone e texto, e nunca como faixa de aviso.

Detalhes em [SPEC-0004](../../../../Specs/features/SPEC-0004--planejamento/spec.md).
