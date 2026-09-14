import { fixture } from '../tests/fixtures';
import { NFeService } from '../src/server/services/nfe';
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { SYNTHETIC_TEST_CPF } from '../src/server/sample-data';
async function main() {
  const f = await fixture();
  try {
    const service = new NFeService(f.db);
    mkdirSync('tmp/pdf-qa', { recursive: true });
    const single = await service.generate(f.draft, randomUUID());
    writeFileSync('tmp/pdf-qa/single.pdf', service.file(single.id, 'pdf').content);
    const person = await f.db.save('entities', {
      ...f.recipient,
      id: undefined,
      type: 'PF',
      document: SYNTHETIC_TEST_CPF,
      name: 'PRODUTOR RURAL DE TESTE',
      stateRegistration: '131234567',
      ieIndicator: '1',
      defaultSerie: 920,
    });
    const pf = await service.generate(
      { ...f.draft, emitterId: person.id, serie: 920 },
      randomUUID(),
    );
    writeFileSync('tmp/pdf-qa/pf.pdf', service.file(pf.id, 'pdf').content);
    const draft = structuredClone(f.draft);
    draft.items = Array.from({ length: 65 }, (_, i) => ({
      ...draft.items[0],
      description: `ITEM ${String(i + 1).padStart(2, '0')} - SOJA EM GRAOS COM DESCRICAO LONGA PARA VERIFICAR A QUEBRA DE LINHAS NO DOCUMENTO DE TESTE`,
      quantity: '10',
    }));
    draft.transport = {
      ...draft.transport,
      mode: '1',
      document: SYNTHETIC_TEST_CPF,
      name: 'TRANSPORTADORA DE TESTE',
      plate: 'ABC1D23',
      plateUf: 'MT',
      volumes: [
        {
          quantity: 1,
          kind: 'GRANEL',
          brand: 'TESTE',
          number: '1',
          netWeight: '30000',
          grossWeight: '31000',
        },
        {
          quantity: 2,
          kind: 'SACOS',
          brand: 'TESTE',
          number: '2',
          netWeight: '1000',
          grossWeight: '1200',
        },
      ],
    };
    draft.additionalInfo =
      'Informacoes complementares de teste para conferir legibilidade e quebra de linha. '
        .repeat(20)
        .trim();
    const multiple = await service.generate(draft, randomUUID());
    writeFileSync('tmp/pdf-qa/multipage.pdf', service.file(multiple.id, 'pdf').content);
    console.log(
      'QA PDFs written to tmp/pdf-qa; temporary fixtures do not affect application data.',
    );
  } finally {
    f.cleanup();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
