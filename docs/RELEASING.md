# Publicação de releases do NF-e Mock

## Branches

- `feature/*`, `feat/*`, `fix/*`, `docs/*` e `refactor/*` apontam para `developer`.
- `developer` publica versões beta.
- Um pull request de `developer` para `main` promove a mesma linha para estável.
- Hotfix crítico parte de `main`, volta para `main` e depois é sincronizado com `developer`.

Proteja as duas branches de release, exija CI e revisão e bloqueie pushes
diretos. Permita que a identidade do GitHub Actions crie o commit estável de
changelog em `main`.

## Cálculo de versão

O semantic-release analisa Conventional Commits:

| Commit                                        | Efeito na versão       |
| --------------------------------------------- | ---------------------- |
| `fix`, `perf`                                 | PATCH                  |
| `feat`                                        | MINOR                  |
| `!` ou `BREAKING CHANGE`                      | MAJOR                  |
| docs, test, refactor, build, ci, chore, style | sem release por padrão |

Em `developer`, uma funcionalidade depois de `0.2.0` produz `0.3.0-beta.1` e
depois `0.3.0-beta.2`. A promoção para `main` produz `0.3.0`, e não `0.3.1`.
Uma mudança incompatível abaixo de 1.0 promove a versão para 1.0.0.

## Inicialização única

O histórico público limpo começa na tag anotada `v0.1.0`. Depois de criar o
repositório GitHub:

```bash
git remote add origin <repositorio-github>
git push -u origin main
git push -u origin developer
git push origin v0.1.0
```

Crie a primeira GitHub Release usando a tag existente. Em seguida, execute
manualmente o workflow Docker com versão `0.1.0`, ref `v0.1.0` e canal
`stable`. As releases seguintes serão automáticas.

## Configuração externa obrigatória

Crie no Docker Hub um repositório público chamado `nfe-mock`. Gere um Access
Token, nunca use a senha da conta, e configure estes secrets no GitHub Actions:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

As GitHub Releases usam o `GITHUB_TOKEN` fornecido automaticamente. Não é
necessário criar Personal Access Token. Habilite o GitHub Private Vulnerability
Reporting antes de anunciar o repositório.

## Tags Docker

Prereleases publicam a versão imutável e as tags móveis `beta` e `developer`.
Releases estáveis publicam versão imutável, minor, major e `latest`. Uma tag
curta `sha-*` fornece rastreabilidade.

Tags versionadas nunca devem receber conteúdo diferente. Em caso de falha,
corrija e publique o próximo PATCH. Para rollback, selecione a versão imutável
anterior; somente `latest`, `beta` e `developer` podem avançar.

Se o Docker falhar depois da GitHub Release, execute manualmente o workflow
Docker contra a tag Git existente. Não crie outro beta nem mova a tag.
