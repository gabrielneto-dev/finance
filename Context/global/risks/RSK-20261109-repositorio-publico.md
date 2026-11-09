---
id: "CTX-RSK-20261109-repositorio-publico"
type: "risk"
title: "Repositório público com código e specs do Finance"
branch: "global"
tags: ["seguranca"]
status: "open"
created_at: "2026-11-09"
updated_at: "2026-11-09"
source_ids: []
related: ["CTX-RSK-20261108-isolamento", "CTX-NTE-20261109-ambiente-local"]
---

# Repositório público com código e specs do Finance

Em 2026-11-09, o projeto foi publicado em `gabrielneto-dev/finance`, que é **público**, por escolha do usuário. Um commit com `.env`, chave local, banco SQLite ou dados reais em Context ou Specs exporia credenciais e informações financeiras.

**Mitigação atual.** O `.gitignore` exclui `.env`, `.env.*` (exceto `.env.example`), `data/`, `node_modules/`, `.next/` e `*.tsbuildinfo`. Antes do primeiro commit, uma busca nos arquivos enviados não encontrou credenciais da Pluggy, ID do Item, chave local nem dados pessoais.

**Antes de cada commit.** Confira `git diff --cached --name-only`, repita a busca por segredos e mantenha dados reais fora dos registros. Considere tornar o repositório privado.
