# NF-e Mock

[![Licença: MIT](https://img.shields.io/badge/Licen%C3%A7a-MIT-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg)](package.json)
[![CI](https://github.com/mschueroff/nfe-mock/actions/workflows/ci.yml/badge.svg)](https://github.com/mschueroff/nfe-mock/actions/workflows/ci.yml)

Gerador local de NF-e para desenvolvimento, QA e testes de integração,
permitindo gerar XML NF-e 4.00, chave de acesso e DANFE sem transmissão à SEFAZ.

> Este projeto destina-se exclusivamente a desenvolvimento de software, QA e
> testes de integração. Os documentos gerados pelo NF-e Mock não são
> autorizados pela SEFAZ e não possuem validade fiscal.

O NF-e Mock **não** é um emissor fiscal, não transmite documentos, não
substitui os serviços da SEFAZ e não deve ser usado para representar uma NF-e
autorizada.

## Funcionalidades

- Geração local e offline de documentos de teste NF-e modelo 55.
- XML NF-e 4.00, chave de acesso e cálculo do dígito verificador.
- DANFE PDF com os avisos permanentes `DOCUMENTO DE TESTE` e `SEM VALOR FISCAL`.
- Cadastro único de entidades: a mesma pessoa ou empresa pode ser emitente ou destinatária.
- Emitentes pessoa física para cenários de produtor rural, incluindo séries 920–969.
- Produtos reutilizáveis e escolha do CFOP por operação e por item.
- Persistência SQLite, sequências determinísticas e geração idempotente.
- Validação do XML com o perfil de schema de teste sem assinatura incluído no projeto.
- Interface em português do Brasil com máscaras de CPF/CNPJ e seletores nativos de data.

## Casos de uso

- Desenvolver e testar integrações de ERP, logística e contabilidade.
- Produzir fixtures repetíveis de XML e DANFE para ambientes de QA.
- Exercitar venda, remessa para armazém, devolução e outros cenários de CFOP.
- Validar chaves de acesso, totais, sequências e persistência local.

## Requisitos

- Node.js 22.14 ou superior.
- npm 10 ou superior.
- Toolchain C/C++ quando uma dependência nativa pré-compilada não estiver disponível.
- Docker com Compose v2 para execução em contêiner.

## Início rápido

```bash
git clone https://github.com/mschueroff/nfe-mock.git
cd nfe-mock
cp .env.example .env
npm ci
npm run seed
npm run dev
```

Acesse <http://127.0.0.1:3010>. O comando de seed é opcional e cria somente
cadastros explicitamente fictícios.

## Execução com Docker

```bash
docker compose up -d --build
```

A aplicação ficará disponível em <http://127.0.0.1:3010>. Os dados serão
armazenados no volume nomeado `nfe_mock_data`.

Depois da configuração do namespace no Docker Hub, uma imagem publicada poderá
ser executada com:

```bash
docker run --name nfe-mock \
  -p 3010:3010 \
  -v nfe-mock-data:/app/data \
  <usuario-dockerhub>/nfe-mock:latest
```

Substitua `<usuario-dockerhub>` pela conta que publica o projeto. Consulte o
[guia de releases](docs/RELEASING.md) para configurar os repositórios.

## Configuração

| Variável       | Padrão            | Finalidade                                          |
| -------------- | ----------------- | --------------------------------------------------- |
| `PORT`         | `3010`            | Porta HTTP do servidor standalone ou do contêiner.  |
| `NFE_DATA_DIR` | `./data`          | Diretório do banco SQLite e dos documentos gerados. |
| `APP_VERSION`  | versão do package | Versão da release exposta pela API.                 |
| `APP_COMMIT`   | `development`     | Hash Git válido, exposto de forma abreviada.        |

Os scripts npm de desenvolvimento usam intencionalmente a porta 3010. Quando
necessário, informe outra porta diretamente à CLI do Next.js.

## Geração de uma NF-e

1. Cadastre entidades que poderão atuar como emitente ou destinatária.
2. Cadastre produtos e os CFOPs necessários ao cenário de teste.
3. Inicie uma nova NF-e de teste e selecione emitente, destinatário e operação.
4. Adicione produtos, escolha ou ajuste o CFOP por item e revise os totais.
5. Gere e baixe o XML, o DANFE ou um ZIP com os dois arquivos.

Todos os identificadores fornecidos pelo seed são sintéticos. CPF e CNPJ
matematicamente válidos são fixtures de teste e não pretendem identificar uma
pessoa ou organização real.

## Arquivos gerados

Por padrão, os dados são gravados em:

```text
data/
├── nfe-mock.sqlite
└── nfe/<documento>/<ano>/<mês>/<chave-de-acesso>/
    ├── nfe.xml
    ├── danfe.pdf
    └── .nfe-mock.json
```

O diretório inteiro é ignorado pelo Git e pelo Docker. Trate-o como
potencialmente sensível caso dados fiscais reais sejam digitados nos testes locais.

## API e arquitetura

A interface usa uma API HTTP local restrita a hosts de loopback. Endpoints
operacionais úteis:

- `GET /health` — resposta mínima para healthcheck do contêiner.
- `GET /api/health` — healthcheck mantido por compatibilidade.
- `GET /api/version` — nome, versão e revisão abreviada da aplicação.

```text
Navegador
   ↓
Aplicação web Next.js e route handlers
   ↓
Serviços da aplicação
   ├── geração de XML NF-e e chave de acesso
   ├── geração de DANFE
   ├── controle de sequência e idempotência
   └── recuperação e persistência
   ↓
SQLite e sistema de arquivos local
```

A API existe para gerar fixtures e documentos de teste. Ela não possui operação
de autorização ou transmissão fiscal.

## Desenvolvimento e testes

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Os testes cobrem chave de acesso e DV, XML/XSD, DANFE, totais decimais,
sequências, concorrência, recuperação, persistência, entidades unificadas,
CFOPs, emitente produtor rural pessoa física e contratos dos campos da interface.

## Versionamento e imagens Docker

O projeto usa Versionamento Semântico e Conventional Commits. Alterações
relevantes integradas em `developer` geram prereleases `PROXIMA_VERSAO-beta.N`.
Alterações integradas em `main` geram releases estáveis. Commits apenas de
documentação ou manutenção não geram release por padrão.

Tags Docker estáveis incluem a versão completa, linha minor, linha major e
`latest`. Prereleases incluem a versão beta completa, `beta` e `developer`;
betas nunca atualizam `latest`.

## Segurança

Não versione bancos, XML/PDF gerados, arquivos de ambiente, certificados ou
chaves privadas. Relate vulnerabilidades pelo GitHub Private Vulnerability
Reporting, conforme descrito em [SECURITY.md](SECURITY.md).

## Limitações

- Os documentos gerados são artefatos de teste sem assinatura.
- Não existe gerenciamento de certificado nem comunicação com a SEFAZ.
- O perfil de schema adaptado apenas torna opcional a assinatura do XML.
- Nem todos os cenários tributários ou eventos de NF-e estão implementados.
- Os dados locais não são criptografados em repouso.

## Roadmap

- Ampliar a configuração tributária.
- Importar XML e clonar documentos de teste.
- Adicionar outros modelos de documento.
- Expandir a API voltada à geração de fixtures.
- Internacionalizar a interface.

## Como contribuir

Consulte [CONTRIBUTING.md](CONTRIBUTING.md). Ao participar, siga o
[Código de Conduta](CODE_OF_CONDUCT.md).

## Licença

O NF-e Mock é disponibilizado sob a [Licença MIT](LICENSE). Avisos das
dependências e do código adaptado estão em
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Aviso legal

A saída foi projetada para ser claramente diferente de um documento fiscal
autorizado. O NF-e Mock nunca cria protocolo de autorização da SEFAZ e não deve
ser usado para contabilidade, declaração fiscal ou comprovação comercial.
