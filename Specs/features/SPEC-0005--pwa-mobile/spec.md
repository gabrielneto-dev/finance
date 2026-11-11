---
id: "SPEC-0005"
title: "Finance no celular como PWA"
status: "draft"
created_at: "2026-11-11"
updated_at: "2026-11-11"
priority: "next"
dependencies: ["SPEC-0001", "SPEC-0002"]
context_refs: ["CTX-DEC-20261108-pluggy-web-mobile", "CTX-DEC-20261108-acesso-finance", "CTX-QUE-20261108-publico-plataformas", "CTX-RSK-20261108-isolamento", "CTX-RSK-20261109-repositorio-publico", "CTX-DEC-20261109-sem-avisos-de-atraso"]
supersedes: null
superseded_by: null
---

# Finance no celular como PWA

Classificação **Critical**: envolve autenticação pública, dados financeiros reais e produção. O plano completo, com arquitetura, ambientes, testes, riscos e estimativas, está em [docs/mobile-plan.md](../../../docs/mobile-plan.md).

## Problema, objetivo e escopo

O usuário quer consultar o Finance no Android, receber aviso de transferência e conectar bancos pelo celular, acessando o backend pela internet. Na Fase 2 ele escolheu a abordagem PWA: o próprio web, instalável pelo Chrome, sem loja. O escopo do MVP e o que fica de fora estão no [item 1 do plano](../../../docs/mobile-plan.md#1-escopo-do-mvp).

Quando aprovada, esta spec substitui a parte de paridade web/Android da SPEC-0001 (REQ-001, T002 e T005).

## Requisitos e critérios de aceitação

| ID | Requisito | Aceite resumido (completo no plano, item 10) |
| --- | --- | --- |
| REQ-001 | Backend público em HTTPS com Supabase Auth e sessão estável | Login pelo 4G. Outro e-mail recusado. 401 sem sessão. Sessão válida após 2 h e após 1 dia. Logout revoga. Webhook 204 e Processado. Chave local segue em loopback |
| REQ-002 | Dados do dono preservados na troca para Supabase | Backup antes, contagens iguais antes e depois, migração autorizada pelo usuário |
| REQ-003 | App instalável e Visão geral real no celular | "Instalar app" no Chrome Android, abre em `standalone`, login e Visão geral com dados reais, desktop igual |
| REQ-004 | Nenhum dado financeiro em cache no aparelho | Página offline estática. Cache Storage sem `/api/*` nem HTML autenticado |
| REQ-005 | Push de transferência com o app fechado | Teste e transferência real chegam com a tela bloqueada. Nenhum aviso perdido em 7 dias. Sem envio na primeira importação |
| REQ-006 | Push seguro e privado | Inscrição só do dono, endpoint `https` de serviço conhecido (contra SSRF), limpeza em 404/410, sem valor por padrão, logs sem valores |
| REQ-007 | Telas essenciais usáveis por toque | Sem rolagem horizontal a 360 px. Alvos de pelo menos 48 × 48 px. Estados de carregando, erro e vazio. Desktop igual |
| REQ-008 | Conectar e reautorizar instituição pelo app instalado | OAuth do sandbox volta ao app e a conexão fica Conectada. Cancelar ou falhar permite tentar de novo. Reautorização da MeuPluggy conclui |

## Limites, premissas, dependências e perguntas

- Só Android e só o dono. iOS, loja, app nativo e uso offline com dados ficam fora.
- Premissas (HIPÓTESE): produção na máquina Linux com o túnel em `finance.vetracompany.com.br`, homologação no mesmo host com sandbox e sem webhook, e push sem valor na tela bloqueada.
- Dependência nova prevista: `web-push`, só no REQ-005. A justificativa está no plano, item 5.
- Plano B: Expo, se o push ou o retorno do OAuth falharem na prática (plano, item 13).
- Perguntas abertas: no [item 14 do plano](../../../docs/mobile-plan.md#14-perguntas-abertas).
