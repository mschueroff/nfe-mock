import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixtures';
import { NFeService } from '../src/server/services/nfe';
import { AccessKeyService } from '../src/server/fiscal/access-key';
import { validateXsd } from '../src/server/fiscal/xsd';
import { sampleRecipient, SYNTHETIC_TEST_CPF } from '../src/server/sample-data';

test('rural producer CPF emitters generate XML, access key, DANFE and sequences', async () => {
  const f = await fixture();
  try {
    const person = await f.db.save('entities', {
      ...sampleRecipient,
      type: 'PF',
      name: 'PRODUTOR RURAL DE TESTE',
      document: SYNTHETIC_TEST_CPF,
      ieIndicator: '1',
      stateRegistration: '131234567',
      initialNumber: 500,
    });
    assert.equal(person.defaultSerie, 920);
    assert.ok(f.db.list('emitters').some((entity) => entity.id === person.id));
    const service = new NFeService(f.db);
    const draft = { ...f.draft, emitterId: person.id, serie: 920 };
    assert.equal(service.preview(draft).number, 500);
    assert.throws(() => service.preview({ ...draft, serie: 1 }), /920 e 969/);
    const result = await service.generate(draft, randomUUID());
    const xml = service.file(result.id, 'xml').content.toString();
    const emit = xml.match(/<emit>([\s\S]*?)<\/emit>/)![1];
    assert.ok(emit.includes(`<CPF>${SYNTHETIC_TEST_CPF}</CPF>`));
    assert.doesNotMatch(emit, /<CNPJ>/);
    await validateXsd(xml);
    assert.equal(result.accessKey.slice(6, 20), SYNTHETIC_TEST_CPF.padStart(14, '0'));
    assert.ok(AccessKeyService.valid(result.accessKey));
    assert.equal(f.db.sequence(person.id, 920)?.next_number, 501);
    assert.equal(service.file(result.id, 'pdf').content.subarray(0, 5).toString(), '%PDF-');
    const copy = service.duplicate(result.id);
    assert.equal(copy.emitterId, person.id);
    assert.equal((await service.generate(copy, randomUUID())).number, 501);
    await assert.rejects(
      f.db.save(
        'entities',
        { ...person, document: `${SYNTHETIC_TEST_CPF.slice(0, -1)}1` },
        person.id,
      ),
      /CPF inválido/,
    );
    await assert.rejects(
      f.db.save('entities', { ...person, document: f.recipient.document, type: 'PJ' }, person.id),
      /não pode ser alterado/,
    );
  } finally {
    f.cleanup();
  }
});
