# Instruções do projeto Finance

<!-- CONTEXT-ENGINEERING:START -->
Antes de trabalho não trivial, leia [MAP](Context/MAP.md) e [STATE](Context/STATE.md).
Carregue somente os índices, registros e fontes que afetam a tarefa. O [manual](Context/README.md) descreve busca, auditoria e manutenção.

Este arquivo rege a operação. `Context/` guarda conhecimento e decisões. `Specs/` guarda execução. Confirme o estado implementado no código e nas evidências.
Leia contexto conforme a tarefa. Persista memória geral quando o usuário pedir para salvar ou atualizar contexto ou criar checkpoint. Siga o protocolo do manual e destile conhecimento durável.

Mantenha credenciais e dados financeiros reais fora de código, documentação, exemplos, evidências e logs. Use referências a variáveis de ambiente e dados sintéticos.
<!-- CONTEXT-ENGINEERING:END -->

<!-- SPEC-DRIVEN:START -->
Consulte [índice](Specs/INDEX.md) e [estado](Specs/STATE.md), localize uma spec equivalente e classifique a mudança pelo [protocolo SDD](Specs/README.md).
Para mudanças significativas, estabeleça requisitos verificáveis, plano e tarefas antes de implementar. Valide cada entrega, reconcilie documentação e código e grave o progresso incremental em `Specs/`.
Em uma nova sessão, recupere a próxima tarefa elegível pelos arquivos. A persistência operacional em `Specs/` é automática. A gravação de memória geral segue o protocolo de `Context/`.
Preserve alterações existentes e exija autorização para ações destrutivas. Commits e pushes dependem de instrução ou política explícita.
<!-- SPEC-DRIVEN:END -->
