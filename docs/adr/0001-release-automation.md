# ADR 0001: semantic-release para GitHub e Docker

## Estado

Aceita.

## Contexto

O NF-e Mock precisa calcular versões a partir de Conventional Commits, gerar
betas numerados em `developer`, promover versões estáveis em `main`, criar tags
Git imutáveis e permitir reexecuções idempotentes. A aplicação não deve ser
publicada no npm.

## Decisão

Usar semantic-release com `developer` como canal prerelease `beta` e `main`
como canal estável. A lista explícita de plugins exclui a publicação npm.
O campo `private: true` permanece no `package.json` como proteção adicional
contra uma publicação npm acidental.
GitHub Releases formam o histórico das betas; releases estáveis também atualizam
a versão do package e o `CHANGELOG.md`.

Uma tag inicial `v0.1.0` evita a versão inicial padrão 1.0.0 do
semantic-release. A publicação Docker recebe a versão e a revisão Git exatas e
pode ser repetida manualmente sem recalcular a versão.

## Consequências

Os workflows de release precisam ser serializados e ter escrita no GitHub. A
proteção de `main` deve permitir o commit de changelog do bot. Os namespaces do
GitHub e Docker Hub permanecem configuração externa, não constantes do código.
