# Restrições

- Priorizar a web na primeira entrega. O app móvel será Android em etapa posterior; a distribuição segue em definição.
- Limitar dados importados ao escopo. Definir finalidade, retenção e exclusão antes de liberar acesso além da prova pessoal autorizada.
- Usar dados sintéticos em testes reproduzíveis, exemplos e evidências. Usar dados reais apenas no ambiente privado autorizado; manter credenciais e dados financeiros fora do código, documentação e logs.
- Hospedar web, worker e SQLite em um mesmo servidor. Usar Supabase Auth na hospedagem HTTPS. O acesso por chave local fica restrito a loopback.
