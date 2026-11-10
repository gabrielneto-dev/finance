---
id: "CTX-DEC-20261110-endereco-publico"
type: "decision"
title: "Receber webhooks no endereço real por túnel da Cloudflare"
branch: "pluggy"
tags: ["pluggy", "seguranca", "plataformas"]
status: "active"
created_at: "2026-11-10"
updated_at: "2026-11-10"
source_ids: []
related: ["CTX-RES-20261110-webhooks-endereco-real", "CTX-DEC-20261108-acesso-finance", "CTX-RES-20261110-frequencia-atualizacao"]
---

# Receber webhooks no endereço real por túnel da Cloudflare

**Contexto.** A fase 2 da SPEC-0002 dependia da escolha entre túnel e hospedagem. Em 2026-11-10, o usuário passou a testar no endereço real `https://finance.vetracompany.com.br`, que já está atrás de um túnel da Cloudflare.

**Decisão.** Os webhooks da Pluggy chegam ao Finance local pelo túnel. O domínio aponta para o servidor do Finance, que nesta máquina é `http://127.0.0.1:3001`.

- O cadastro na Pluggy usa o script `npm --prefix apps/web run webhooks`, com `APP_ORIGIN=https://finance.vetracompany.com.br` apenas nesse comando. O script cadastra os nove eventos do Finance em `/api/webhooks/pluggy`, com o cabeçalho `X-Finance-Webhook-Secret`.
- O `APP_ORIGIN` do `.env` continua `http://127.0.0.1:3001`. Com uma origem HTTPS, a chave local deixaria de valer e o painel passaria a exigir o Supabase Auth, que não está configurado.
- O receptor não depende do `APP_ORIGIN`. Quem acessar pelo domínio público não consegue entrar com a chave local.
- O cadastro antigo `all` em `/connections/pluggy/callback` deve ser removido ou desativado depois que o novo funcionar. Isso exige confirmação do usuário.

**Consequências.** O Finance recebe webhooks enquanto o túnel e o servidor estiverem no ar. O painel não fica acessível pelo domínio público até o Supabase ser configurado. A máquina Linux não tem `cloudflared` instalado; o túnel precisa rodar onde o Finance estiver no ar.

**Pendente.** Ligar o túnel, cadastrar os eventos, reenviar um evento pelo Dashboard e conferir HTTP 204 e "Processado" em Conexões. Tarefa operacional: SPEC-0002-T004.
