# Estado do projeto

Atualizado em 2026-11-08. [Checkpoint atual](checkpoints/CP-20261108-finance-real.md) · [MVP web inicial](checkpoints/CP-20261108-mvp-web.md) · [Bootstrap](checkpoints/CP-20261108-bootstrap.md).

- MVP web rodou com um Item real da Pluggy. O painel autenticado usa SQLite para os dados financeiros e oferece [acesso local por chave ou Supabase Auth no servidor](branches/produto/decisions/DEC-20261108-acesso-finance.md).
- Conexões mostra dados importados, cobertura e situação do webhook. Extrato, Gastos, Cartões e Faturas exibem parcelas futuras como projeções. Gastos concilia categorias com a lista, incluindo pendentes. Cartões e Gastos compartilham o [próximo fechamento e sua origem](branches/produto/decisions/DEC-20261108-ciclos-cartao.md).
- Receptor, worker e avisos de transferência validados localmente; sete testes web passaram na retomada. [Evidências](../Specs/features/SPEC-0001--mvp-finance/verification.md).
- Próxima etapa de homologação: Compose, Supabase Auth, HTTPS, callback do widget e entrega de webhook pelo Dashboard da Pluggy. Consulte o [estado SDD](../Specs/STATE.md) e o [guia de instalação](../README.md#preparar-o-servidor).
- [Android](branches/produto/decisions/DEC-20261108-pluggy-web-mobile.md) fica para a etapa seguinte. A [distribuição](branches/produto/questions/QUE-20261108-publico-plataformas.md) continua em aberto.
