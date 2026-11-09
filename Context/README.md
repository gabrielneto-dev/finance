# Memória do projeto

A memória preserva conhecimento útil entre sessões. [Mapa](MAP.md) e [estado](STATE.md) orientam. `core/` guarda fundamentos, `branches/` organiza domínios, `global/` reúne registros transversais, `sources/` guarda evidências e `checkpoints/` preserva marcos. Crie `future/` ou `archive/` quando houver material. O [SDD](../Specs/README.md) guarda o progresso de implementação.

## Recuperação

1. Entenda a tarefa e leia mapa e estado (L0).
2. Abra somente o índice da branch pertinente (L1). Consulte o catálogo por ID, tipo, tag, status ou palavras-chave. Exemplo com `rg`, quando instalado, `rg -n 'pluggy|sandbox' Context/_meta/catalog.jsonl`.
3. Leia os registros necessários (L2). Siga relações de impacto direto, em geral um nível. Consulte fontes (L3) quando precisar confirmar evidências ou contratos.
4. Priorize relevância, status, atualidade, confiança e qualidade da fonte. Confirme o sucessor antes de usar um registro substituído. Verifique o código para determinar o que funciona.

## Registros e manutenção

Use [taxonomia](_meta/taxonomy.yaml) e [modelo](_meta/templates/generic-record.md). Nomeie o arquivo `TIPO-AAAAMMDD-slug.md` e prefixe o ID com `CTX-`. Mantenha o ID estável. Metadados mínimos em YAML incluem ID, tipo, título, branch, tags, status e datas de criação e atualização. Use `source_ids`, `related`, `depends_on`, confiança, validade e data de revisão quando úteis.

Fatos indicam evidência. Hipóteses indicam como validar e o efeito se forem falsas. Perguntas indicam a decisão afetada. Pesquisas registram método, fonte e limitações. Decisões registram motivo, opções relevantes e consequências. Riscos indicam impacto e mitigação. Planos de conhecimento referenciam as tarefas operacionais no SDD. Experimentos registram hipótese, procedimento, resultado e conclusão.

Preserve registros substituídos com status `superseded` e vínculos `supersedes` e `superseded_by`. Em caso de conflito, registre as fontes e o que falta resolver. Crie uma branch quando houver assunto independente com registros próprios. Atualize taxonomia, mapa, índice da branch e changelog estrutural.

Os arquivos Markdown com ID são canônicos. Para reconstruir [catálogo](_meta/catalog.jsonl), leia seus frontmatters, ignore templates, ordene pelo ID e escreva uma linha JSON por registro com ID, tipo, título, branch, tags, status, data de atualização e caminho relativo a `Context/`.

## Salvar contexto

Quando o usuário pedir para salvar ou atualizar o contexto ou criar checkpoint:

1. Inspecione mudanças e evidências reais. Separe objetivo, decisões, fatos, hipóteses, dúvidas, riscos, verificações e bloqueios.
2. Retenha somente informação durável ou necessária à retomada. Procure equivalentes no catálogo e atualize o registro existente. Registre fontes e relações úteis. Inclua aprendizados de tentativas malsucedidas quando evitarem repetição.
3. Crie [checkpoint](_meta/templates/checkpoint.md) com mudanças, resultados, pendências, próxima ação e referências ao estado do SDD.
4. Atualize estado, catálogo e índices afetados. Altere mapa e changelog apenas por mudança estrutural. Considere mover regras duráveis de trabalho para `AGENTS.md`.
5. Valide IDs, vínculos, tags, status, segurança e rota de retomada. Mantenha credenciais, dados financeiros reais e cópias de conversas fora dos registros.

## Intenções operacionais

- `carregar contexto` recupera mapa, estado e branches pertinentes.
- `buscar contexto <assunto>` procura registros relevantes e fontes.
- `status do contexto` resume estado, checkpoint, lacunas e próximo passo.
- `auditar contexto` verifica catálogo, IDs, referências, tags, status, conflitos, fontes, duplicação, segredos e retomada. Preserve o histórico ao corrigir.
