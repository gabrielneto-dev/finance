---
id: "CTX-DEC-20261108-acesso-finance"
type: "decision"
title: "Autenticação local e autenticação no servidor"
branch: "produto"
tags: ["seguranca", "pluggy", "plataformas"]
status: "active"
created_at: "2026-11-08"
updated_at: "2026-11-08"
related: ["CTX-DEC-20261108-pluggy-web-mobile", "CTX-RSK-20261108-isolamento"]
---

# Autenticação local e autenticação no servidor

Para testar em loopback, a aplicação usa uma chave local e uma sessão revogável com expiração. Na hospedagem HTTPS, o acesso usa Supabase Auth. Os dados financeiros ficam no SQLite nos dois modos. O proprietário local tem identidade estável e distinta da identidade Supabase; a troca de modo não transfere automaticamente os dados.

O backend importa somente o Item autorizado para o proprietário e valida o vínculo antes de consultar os dados. As credenciais e a configuração privada ficam no servidor. Use dados sintéticos em testes reproduzíveis e evidências; consultas reais autorizadas ficam no ambiente privado.

Referências: [guia de execução](../../../../README.md#rodar-localmente-com-a-pluggy), [verificação do acesso local](../../../../Specs/features/SPEC-0001--mvp-finance/verification.md#painel-local-com-a-conexão-real) e [risco de isolamento](../../../global/risks/RSK-20261108-isolamento.md).
