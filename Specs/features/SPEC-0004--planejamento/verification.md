# Verificação do planejamento financeiro

Os registros dizem só se o valor conferiu. Valores reais ficam fora deste arquivo.

## Registro do plano

SPEC-0004-T001 · 2026-11-10 · PASS. Spec, plano, tarefas, pesquisa dos frameworks e decisões registrados. Nada foi implementado ainda.

## Lógica, API e telas

SPEC-0004-T002 a T008 · 2026-11-11 · PASS.
- `npm test`: 94 testes passam. Eram 73; entraram `planning-store`, `planning-logic` e `planning-pluggy` e os testes de negócio na classificação.
- Cobertura de linhas de `lib/planning/` (`--experimental-test-coverage`) entre 93% e 100% por módulo.
- `npx tsc --noEmit` e `npm run build` passam. A rota `/planejamento` e a API `/api/planning` aparecem no build.

Conferência com uma cópia do banco local · 2026-11-11 · PASS.
- A cópia foi feita com `VACUUM INTO` no scratchpad e apagada depois. Só resultados booleanos foram impressos.
- Depois de aplicar a sugestão do Plano Consciente, o gasto das caixinhas mais o gasto sem caixinha foi igual às Despesas das Análises em novembro e em outubro de 2026.
- A resposta não teve `NaN` nem `Infinity`, e a projeção trouxe 12 meses.

## Painel real

SPEC-0004-T009 a T011 e T013 · 2026-11-11 · PASS, no `next start` em `127.0.0.1:3001` com o banco local, depois do login do usuário.
- Antes dos testes, as tabelas do planejamento e de escolhas de categoria estavam vazias. Ao final, os dados de teste foram removidos pelas ações da API, e as tabelas voltaram a ficar vazias.
- **Mês e Caixinhas.** A sugestão pelo Plano Consciente criou quatro caixinhas, com situação, marca do ritmo e valor por dia. A edição pelo painel lateral salvou "acumula a sobra". Dezembro recebeu exatamente a sobra de novembro só na caixinha que acumula.
- **Metas.** Uma meta de R$ 12.000 com aporte de R$ 1.000 mostrou a data prevista de outubro de 2027.
- **Projeções.** O ajuste "Salário +10%", ligado, mudou o cenário. O efeito no fim de 12 meses foi igual a 10% da renda prevista vezes 12.
- **Patrimônio.** Um investimento manual entrou no patrimônio e na alocação, e a atualização de saldo foi refletida.
- **Negócio.** Sem lançamentos marcados, a página mostra o estado vazio com instruções e sem banner. Ao marcar uma conta como do negócio:
  - Negócio passou a mostrar vendas, custos, lucro e Profit First;
  - as Análises de outubro tiraram o negócio das despesas e somaram o resultado dele no Resultado;
  - o Fluxo de caixa mostrou a barra do negócio.
- **Ocultar valores.** Patrimônio, saldos, investimentos e o eixo do gráfico foram mascarados, e os percentuais continuaram visíveis.
- **375 px.** As seis páginas ficaram sem rolagem horizontal.
- **Console e log.** Sem erros.

Correções feitas durante a conferência e cobertas por testes:
- O Plano Consciente passou a medir o gasto real pelos grupos de cada fatia, e não pelas caixinhas do usuário, com meio ponto de tolerância nas bordas da faixa.
- A renda dos meses futuros passou a usar só meses completos antes do mês atual. Antes, um mês parcial ou vazio distorcia a projeção.
- O cabeçalho dos cards quebra linha no celular.
- O mês aparece como "Novembro de 2026".

Pendente.
- Investimentos pela Pluggy com o Item real (T012). Depende da reautorização da conexão MeuPluggy.
