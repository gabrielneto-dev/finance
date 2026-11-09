# Desenvolvimento orientado por especificações

Comece pelo [índice](INDEX.md) e pelo [estado](STATE.md). `Specs/` guarda requisitos, plano, tarefas e evidências. [Contexto](../Context/MAP.md) guarda decisões duráveis, fontes e histórico. Código e testes mostram o estado implementado.

## Profundidade

| Nível | Aplicação | Evidência mínima |
| --- | --- | --- |
| Trivial | Correção pontual | Checagem proporcional |
| Lightweight | Mudança localizada | Objetivo, aceitação, passos e verificação. Combine documentos se conveniente |
| Full | Funcionalidade, integração ou mudança estrutural | Spec, plano, tarefas e verificação |
| Critical | Autorização, dados financeiros, produção ou mudanças irreversíveis | Full, riscos, segurança, compatibilidade e recuperação. Exija autorização para ações destrutivas ou irreversíveis |

## Ciclo e persistência

1. Descubra o contexto e procure spec equivalente. Use `SPEC-NNNN` para funcionalidades, `REQ-NNN` dentro da spec e `SPEC-NNNN-TNNN` para tarefas. Preserve IDs. Specs podem estar em `draft`, `active`, `completed`, `superseded` ou `archived`.
2. Especifique escopo, critérios testáveis, premissas e questões. Resolva lacunas de alto impacto antes da implementação afetada. Registre o plano e decomponha em tarefas com requisitos, dependências, estado e condição de conclusão.
3. Implemente a próxima tarefa elegível depois de comparar o estado com código e testes. Marque `in_progress` ao começar. Estados permitidos são `pending`, `ready`, `in_progress`, `blocked`, `completed` e `cancelled`.
4. Verifique critérios com testes ou procedimentos apropriados. Registre requisito, método, data, resultado, evidência e limites. Use `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN` ou `NOT_APPLICABLE`. Reabra trabalho quando uma verificação mostrar falha. Conclua uma spec quando critérios, riscos, tarefas e evidências estiverem reconciliados.
5. Persista em `Specs/` a cada alteração de spec, plano, tarefas, verificação, bloqueio ou fase e antes de trocar de funcionalidade. Atualize `tasks.md`, evidências e `STATE.md` conforme o efeito observado. Atualize `INDEX.md` por mudanças no inventário, prioridade ou status. Use links para decisões do contexto. Ao receber `salvar contexto`, referencie o estado SDD no checkpoint e siga o [manual da memória](../Context/README.md).

## Retomada e auditoria

Leia as [instruções](../AGENTS.md), [mapa](../Context/MAP.md), [estado do contexto](../Context/STATE.md), índice e estado SDD. Abra a spec ativa e os trechos relevantes do plano, tarefas e verificação. Inspecione código, alterações locais e testes. Confirme próxima tarefa e dependências. Corrija divergências entre requisitos, plano, código e evidência. Preserve histórico e use `supersedes` e `superseded_by` se houver substituição.

Cheque requisitos sem tarefas, tarefas concluídas sem evidência, testes falhos em specs concluídas, mudanças fora do escopo, decisões sem referência e estados que divergem dos artefatos. Mantenha segredos e dados financeiros reais fora dos registros.

## Intenções operacionais

| Intenção | Ação |
| --- | --- |
| `iniciar spec` | Localizar spec equivalente ou criar proposta |
| `planejar spec` | Definir ou revisar solução e riscos |
| `gerar tarefas` | Decompor o plano e ligar tarefas a critérios |
| `implementar spec` | Executar as tarefas elegíveis |
| `validar spec` | Verificar os critérios e registrar resultados |
| `status sdd` | Resumir fase, progresso, bloqueios e próximo passo |
| `retomar desenvolvimento` | Recuperar arquivos e reconciliar o estado real |
| `auditar sdd` | Checar integridade, rastreabilidade e divergências |
| `salvar contexto` | Seguir o protocolo da memória |
