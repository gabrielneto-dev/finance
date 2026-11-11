---
id: "SPEC-0005"
title: "Finance no celular: app Android em React Native"
status: "active"
created_at: "2026-11-11"
updated_at: "2026-11-11"
priority: "next"
dependencies: ["SPEC-0001", "SPEC-0002"]
context_refs: ["CTX-DEC-20261108-pluggy-web-mobile", "CTX-DEC-20261108-acesso-finance", "CTX-QUE-20261108-publico-plataformas", "CTX-RSK-20261108-isolamento", "CTX-RSK-20261109-repositorio-publico", "CTX-DEC-20261109-sem-avisos-de-atraso"]
supersedes: null
superseded_by: null
---

# Finance no celular: app Android em React Native

A pasta mantém o nome `pwa-mobile` para preservar os links e o ID. Em 2026-11-11, o usuário trocou a abordagem de PWA para app React Native (Expo). O plano da PWA está no commit `f5be6c2`.

Classificação **Critical**: envolve autenticação pública, dados financeiros reais e produção. O plano completo, com arquitetura, ambientes, testes, riscos e estimativas, está em [docs/mobile-plan.md](../../../docs/mobile-plan.md).

## Problema, objetivo e escopo

O usuário quer consultar o Finance no Android, receber aviso de transferência e conectar bancos pelo celular, acessando o backend pela internet. A abordagem é um app Android em React Native com Expo, instalado por APK, sem loja. O escopo do MVP e o que fica de fora estão no [item 1 do plano](../../../docs/mobile-plan.md#1-escopo-do-mvp).

Quando aprovada, esta spec substitui a parte de paridade web/Android da SPEC-0001 (REQ-001, T002 e T005).

## Requisitos e critérios de aceitação

| ID | Requisito | Aceite resumido (completo no plano, item 10) |
| --- | --- | --- |
| REQ-001 | Backend público em HTTPS com Supabase Auth e sessão estável | Login pelo 4G. Outro e-mail recusado. 401 sem sessão. Sessão válida após 2 h e após 1 dia. Logout revoga. Webhook 204 e Processado. Chave local segue em loopback |
| REQ-002 | Conta reconectada na produção (o usuário escolheu reconectar em 2026-11-11, e não migrar) | Conexão Conectada pelo usuário Supabase, saldos iguais aos do banco, e o banco local intacto. Planejamento e categorias começam vazios, como o usuário aceitou. O script `migrate-owner` fica como alternativa testada |
| REQ-003 | App com login e Visão geral real no celular | APK instalado. Login pelo 4G com o usuário Supabase. Visão geral com os mesmos valores do web. A prévia web nesta máquina funciona com dados sintéticos |
| REQ-004 | Sessão segura e nenhum dado financeiro gravado no aparelho | Sessão cifrada com chave no Keystore (SecureStore). Sem cache de dados financeiros. Sair apaga a sessão e o registro de push. O servidor aceita Bearer só no modo Supabase, valida o dono e dispensa `Origin` apenas com Bearer |
| REQ-005 | Push de transferência com o app fechado | Teste e transferência real chegam com a tela bloqueada. Nenhum aviso perdido em 7 dias. Sem envio na primeira importação |
| REQ-006 | Push seguro e privado | Aparelho registrado só pelo dono. FCM HTTP v1 com credencial só no servidor. Token inválido apagado. Sem valor por padrão. Logs sem valores nem tokens. `google-services.json` e keystore fora do Git |
| REQ-007 | Telas essenciais usáveis por toque | Abas, toques de 48 dp e estados de carregando, erro e vazio conferidos. Fatura aberta e Extrato com os mesmos valores do web |
| REQ-008 | Conectar e reautorizar instituição pelo app | OAuth do sandbox volta ao app por `finance://` e a conexão fica Conectada. Cancelar ou falhar permite tentar de novo. Reautorização da MeuPluggy conclui |
| REQ-009 | APK de uso diário | APK de release instala por cima sem perder o login. Chave de assinatura fora do Git, com cópia do usuário |

## Limites, premissas, dependências e perguntas

- Só Android e só o dono. iOS, Play Store, uso offline com dados e as telas de análise e planejamento ficam fora do app.
- Produção no servidor da casa do usuário, atrás do Cloudflare Tunnel em `finance.vetracompany.com.br` (resposta do usuário em 2026-11-11).
- O servidor de casa tem Ubuntu Server, Docker e `cloudflared`, e não é a máquina com o banco atual (respostas do usuário em 2026-11-11).
- Premissas (HIPÓTESE): homologação no mesmo host com sandbox e sem webhook, e push sem valor na tela bloqueada.
- Novo projeto `apps/mobile` (Expo SDK 58), com dependências próprias. Builds Android pelo EAS, porque esta máquina não tem Android SDK e o Expo não suporta build local no Windows.
- O usuário cria as contas Expo e Firebase.
- Perguntas abertas: no [item 13 do plano](../../../docs/mobile-plan.md#13-perguntas-abertas).
