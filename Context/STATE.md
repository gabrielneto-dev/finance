# Estado do projeto

Atualizado em 2026-11-09. [Checkpoint atual](checkpoints/CP-20261109-validacao-web.md) · [Finance com Pluggy real](checkpoints/CP-20261108-finance-real.md) · [MVP web inicial](checkpoints/CP-20261108-mvp-web.md) · [Bootstrap](checkpoints/CP-20261108-bootstrap.md).

- O MVP web roda com um Item real da Pluggy, via conector MeuPluggy. O painel autenticado usa SQLite e oferece [acesso local por chave ou Supabase Auth no servidor](branches/produto/decisions/DEC-20261108-acesso-finance.md).
- A validação web local terminou. Extrato, Gastos, Cartões e Faturas conferem com o SQLite. O cronograma de parcelas segue as [regras de ciclo do cartão](branches/produto/decisions/DEC-20261108-ciclos-cartao.md). A suíte web tem 17 testes passando.
- A conexão MeuPluggy só sincroniza uma vez por dia e não aceita atualização pela API. O Atualizar reimporta o que a Pluggy já tem. Para antecipar, use o app Meu Pluggy. Compras do cartão chegam com dois a três dias de atraso. Ver [pesquisa](branches/pluggy/research/RES-20261109-sincronizacao-meupluggy.md) e [decisão](branches/pluggy/decisions/DEC-20261109-atualizacao-conexoes.md).
- O painel [não exibe avisos de lançamentos a caminho](branches/produto/decisions/DEC-20261109-sem-avisos-de-atraso.md). O usuário rejeitou esse tipo de aviso.
- Para rodar localmente, siga o [ambiente local](global/notes/NTE-20261109-ambiente-local.md): `next start` na porta 3001, worker separado e parada do servidor antes do build.
- O código está em `gabrielneto-dev/finance`, que é público. Confira segredos antes de cada commit. Ver [risco](global/risks/RSK-20261109-repositorio-publico.md).
- Próximas etapas: a homologação pública foi adiada pelo usuário e o [Android](branches/produto/decisions/DEC-20261108-pluggy-web-mobile.md) vem depois. A [distribuição](branches/produto/questions/QUE-20261108-publico-plataformas.md) segue em aberto. Ver o [estado SDD](../Specs/STATE.md).
