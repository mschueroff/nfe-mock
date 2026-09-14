# Origem e adaptações locais

Estes módulos offline têm origem no `@brasil-fiscal/nfe` 2.0.7, revisão
`ed72d00bc2794ba16e65418dbd446ef9c3035474`. A licença MIT original está
preservada em `LICENSE`.

Fonte: https://github.com/brasil-fiscal/nfe/tree/ed72d00bc2794ba16e65418dbd446ef9c3035474

O gerador preserva a montagem de emitente, destinatário, endereços, transporte,
pagamentos e informações adicionais. Identificação, itens e totais usam as
funções tipadas de `../xml-fragments.ts`, incluindo cNF e chave externos,
decimais, grupos ICMS, substituição tributária, unidades tributáveis e datas
explícitas. O transporte aceita CPF.

O DANFE reaproveita parser, desenho e código de barras. As alterações locais
adicionam aviso e marca d'água em todas as páginas, substituem o campo de
protocolo, preservam o fuso, quebram descrições e repetem cabeçalhos nas páginas
seguintes. Informações adicionais não são truncadas; volumes extras aparecem
em anexo.

Não atualize estes arquivos automaticamente. Execute toda a matriz XSD e revise
os PDFs ao trocar a versão de origem. O NF-e Mock nunca instancia serviço SEFAZ.
