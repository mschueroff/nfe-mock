# Avisos de terceiros

O NF-e Mock usa a Licença MIT. Sua árvore de dependências também contém
software sob MIT, Apache-2.0, BSD, ISC, 0BSD, Zlib, MPL-2.0, Python-2.0,
Artistic-2.0, Creative Commons e opções compatíveis de licenças múltiplas.

## Código de geração fiscal

Os módulos offline adaptados em `src/server/fiscal/vendor` têm origem no
[`@brasil-fiscal/nfe` 2.0.7](https://github.com/brasil-fiscal/nfe/tree/ed72d00bc2794ba16e65418dbd446ef9c3035474)
e preservam sua licença MIT no próprio diretório.

Os schemas de NF-e registram origem, revisão e checksums em
`schemas/manifest.json`. O projeto de origem disponibiliza o material sob
múltiplas licenças, incluindo MIT; o NF-e Mock adota a opção MIT.

## Binários de processamento de imagens

O Next.js pode instalar o `sharp` (Apache-2.0) e binários de `libvips`
específicos para cada plataforma. Esses pacotes contêm bibliotecas LGPL e
outras licenças permissivas. Licenças, avisos e fontes correspondentes estão em:

- https://github.com/lovell/sharp
- https://github.com/lovell/sharp-libvips
- https://github.com/lovell/sharp-libvips/blob/main/THIRD-PARTY-NOTICES.md
- https://github.com/libvips/libvips

Não foi identificada dependência obrigatória GPL ou AGPL. O `jszip` é usado sob
a opção MIT. Os metadados e arquivos de licença de cada pacote são a fonte
definitiva dos respectivos termos.
