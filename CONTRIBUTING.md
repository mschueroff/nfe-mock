# Como contribuir com o NF-e Mock

Obrigado por ajudar a melhorar o NF-e Mock. Toda contribuição deve preservar a
finalidade de gerador local de documentos de teste e nunca deve incluir dados
privados ou dados reais de clientes.

## Fluxo de trabalho

1. Faça um fork e crie uma branch a partir de `developer`.
2. Use um nome curto, como `feat/importacao-xml`, `fix/chave-acesso` ou `docs/docker`.
3. Instale as dependências com `npm ci`.
4. Faça alterações focadas e adicione testes significativos quando o comportamento mudar.
5. Execute `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` e `npm run build`.
6. Abra um pull request para `developer` e preencha o checklist.

Hotfixes de falhas críticas partem de `main`, retornam para `main` e depois são
sincronizados com `developer`.

## Mensagens de commit

Use Conventional Commits:

```text
feat: adicionar importação de XML
fix: calcular o dígito da chave de acesso
docs: esclarecer persistência no Docker
```

Os tipos aceitos incluem `feat`, `fix`, `perf`, `refactor`, `docs`, `test`,
`build`, `ci`, `chore` e `style`. Marque mudanças incompatíveis com `!` ou com
o rodapé `BREAKING CHANGE:`.

## Dados de teste

Use nomes genéricos, como `EMPRESA TESTE LTDA`, e identificadores gerados
somente para testes. Nunca copie CPF, CNPJ, inscrição estadual, endereço, XML,
DANFE ou certificado de cliente, fornecedor ou empregador real.

## Pull requests

Explique a mudança de comportamento, o motivo e a validação realizada. Evite
misturar formatação ou refatoração não relacionada com uma mudança funcional.
