import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccessKeyService } from '../src/server/fiscal/access-key';
import { NFeService } from '../src/server/services/nfe';
import { XmlGeneratorService } from '../src/server/fiscal/xml';
import { validateXsd } from '../src/server/fiscal/xsd';
import { calculate } from '../src/server/fiscal/totals';
import { fixture } from './fixtures';
import { formatDocument, ICMS_CODES, SN_CODES, validDocument } from '../src/shared/contracts';
import { SYNTHETIC_TEST_CNPJ, SYNTHETIC_TEST_CPF } from '../src/server/sample-data';
test('access-key check digit handles synthetic values, padding and invalid components', () => {
  const key = AccessKeyService.build({
    uf: 'MT',
    cnpj: SYNTHETIC_TEST_CNPJ,
    issueDate: '2026-09-30T23:59:59-03:00',
    serie: 1,
    number: 1,
    numericCode: '1',
  });
  assert.equal(AccessKeyService.valid(key), true);
  assert.equal(AccessKeyService.valid(key.slice(0, -1) + '0'), false);
  assert.equal(AccessKeyService.pad(12, 9), '000000012');
  assert.throws(() => AccessKeyService.pad('1234', 3));
  assert.throws(() => AccessKeyService.dv('a'.repeat(43)));
  assert.equal(validDocument(SYNTHETIC_TEST_CPF, 'CPF'), true);
  assert.equal(validDocument('11111111111', 'CPF'), false);
  assert.equal(formatDocument(SYNTHETIC_TEST_CPF, 'CPF'), '910.000.001-92');
  assert.equal(formatDocument(`${SYNTHETIC_TEST_CPF}999`, 'CPF'), '910.000.001-92');
  assert.equal(formatDocument('93000000000172', 'CNPJ'), '93.000.000/0001-72');
  assert.equal(formatDocument('93.000.000/0001-72', 'CNPJ'), '93.000.000/0001-72');
  const dateKey = AccessKeyService.build({
    uf: 'MT',
    cnpj: SYNTHETIC_TEST_CNPJ,
    issueDate: '2026-09-30T23:59:59-03:00',
    serie: 1,
    number: 1,
    numericCode: '1',
  });
  assert.equal(dateKey.slice(2, 6), '2609');
  assert.equal(dateKey.length, 44);
  assert.equal(AccessKeyService.valid(dateKey), true);
  assert.equal(AccessKeyService.numeric('SEQUENTIAL', 1), '00000001');
  assert.match(AccessKeyService.numeric('RANDOM', 1), /^\d{8}$/);
  assert.throws(() => AccessKeyService.numeric('SEQUENTIAL', 100000000));
});
test('fiscal matrix passes the unsigned test XSD while the official XSD requires Signature', async () => {
  const f = await fixture();
  try {
    const service = new NFeService(f.db),
      builder = new XmlGeneratorService();
    for (const crt of ['1', '3']) {
      await f.db.save('emitters', { ...f.emitter, crt }, f.emitter.id);
      for (const code of crt === '1' ? SN_CODES : ICMS_CODES) {
        const draft = structuredClone(f.draft);
        draft.items[0].taxes.icms[crt === '1' ? 'csosn' : 'cst'] = code as never;
        draft.items[0].taxes.icms.rate = '12';
        draft.items[0].taxes.icms.stRate = '18';
        const doc = service.preview(draft),
          xml = builder.generate(doc, true),
          result = await validateXsd(xml);
        assert.equal(result.valid, true, `${crt}/${code}: ${JSON.stringify(result.errors)}`);
        if (crt === '1' && code === '102') {
          const official = await validateXsd(xml, true);
          assert.equal(official.valid, false);
          assert.ok(official.errors.every((e) => e.message.includes('Signature')));
        }
      }
    }
    for (const code of ['01', '03', '07', '49'])
      for (const ipi of ['50', '53']) {
        const draft = structuredClone(f.draft);
        draft.items[0].taxes.pis.cst = code as never;
        draft.items[0].taxes.cofins.cst = code as never;
        draft.items[0].taxes.ipi.enabled = true;
        draft.items[0].taxes.ipi.cst = ipi as never;
        const result = await validateXsd(builder.generate(service.preview(draft), false));
        assert.equal(result.valid, true, JSON.stringify(result.errors));
      }
  } finally {
    f.cleanup();
  }
});
test('decimal totals cover tax substitution, discounts, tax units and limits', async () => {
  const f = await fixture();
  try {
    const result = calculate(f.draft.items, '1');
    assert.equal(result.totals.total, '63000.00');
    const item = structuredClone(f.draft.items[0]);
    item.quantity = '3';
    item.unitPrice = '0.335';
    item.discount = '0.01';
    item.freight = '1';
    item.taxes.icms.cst = '10';
    item.taxes.icms.rate = '12';
    item.taxes.icms.stRate = '18';
    const totals = calculate([item], '3').totals;
    assert.equal(totals.products, '1.01');
    assert.equal(totals.icms, '0.24');
    assert.equal(totals.st, '0.12');
    assert.equal(totals.total, '2.12');
    item.discount = '2';
    assert.throws(() => calculate([item], '3'));
    item.discount = '0';
    item.taxQuantity = '999';
    assert.throws(() => calculate([item], '3'));
  } finally {
    f.cleanup();
  }
});
