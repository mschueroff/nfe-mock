import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fixture } from './fixtures';
import { SYNTHETIC_TEST_CNPJ } from '../src/server/sample-data';
import { NFeService } from '../src/server/services/nfe';
import { Store } from '../src/server/repositories/store';
import { AccessKeyService } from '../src/server/fiscal/access-key';
test('generation covers numbering, idempotency, snapshots, duplication and restart', async () => {
  const f = await fixture();
  try {
    const service = new NFeService(f.db),
      request = randomUUID();
    const preview = service.preview(f.draft);
    assert.equal(preview.number, 1000);
    assert.equal(f.db.sequence(f.emitter.id, 1)?.next_number, 1000);
    const a = await service.generate(f.draft, request),
      b = await service.generate(f.draft, randomUUID());
    assert.equal(a.number, 1000);
    assert.equal(b.number, 1001);
    assert.equal(f.db.sequence(f.emitter.id, 1)?.next_number, 1002);
    assert.equal(AccessKeyService.valid(a.accessKey), true);
    assert.notEqual(a.accessKey, b.accessKey);
    assert.equal((await service.generate(f.draft, request)).id, a.id);
    assert.equal(f.db.sequence(f.emitter.id, 1)?.next_number, 1002);
    await assert.rejects(() => service.generate({ ...f.draft, nature: 'Outra operação' }, request));
    const xml = service.file(a.id, 'xml').content.toString();
    assert.ok(!xml.includes('protNFe'));
    assert.ok(!xml.includes('nfeProc'));
    assert.ok(xml.includes('DOCUMENTO DE TESTE'));
    assert.equal(service.file(a.id, 'pdf').content.subarray(0, 5).toString(), '%PDF-');
    await f.db.save('products', { ...f.product, description: 'MODIFICADO' }, f.product.id);
    assert.equal(f.db.invoice(a.id).snapshot.items[0].description, f.product.description);
    const copy = service.duplicate(a.id, true);
    assert.equal(copy.manualNumber, '');
    assert.equal(copy.sourceInvoiceId, a.id);
    assert.notEqual(copy.issueDate, f.draft.issueDate);
    await f.db.changeInvoice(a.id, 'cancel');
    await f.db.changeInvoice(a.id, 'delete');
    await assert.rejects(() => service.generate({ ...f.draft, manualNumber: 1000 }, randomUUID()));
    const second = new Store(f.root);
    assert.equal(second.history().length, 1);
    second.close();
  } finally {
    f.cleanup();
  }
});
test('sequences remain independent across concurrent series and emitters', async () => {
  const f = await fixture();
  try {
    const service = new NFeService(f.db);
    const invoices = await Promise.all(
      Array.from({ length: 5 }, () => service.generate(f.draft, randomUUID())),
    );
    assert.deepEqual(
      invoices.map((v) => v.number),
      [1000, 1001, 1002, 1003, 1004],
    );
    const other = await service.generate({ ...f.draft, serie: 2 }, randomUUID());
    assert.equal(other.number, 1);
    const another = await f.db.save('emitters', {
      ...f.emitter,
      cnpj: SYNTHETIC_TEST_CNPJ,
      initialNumber: 5000,
    });
    assert.equal(
      (await service.generate({ ...f.draft, emitterId: another.id }, randomUUID())).number,
      5000,
    );
  } finally {
    f.cleanup();
  }
});
test('PDF failure rolls back reservations while manual numbering and reset preserve cNF', async () => {
  const f = await fixture();
  try {
    const bad = new NFeService(f.db, undefined, {
      async generate() {
        throw new Error('PDF indisponível');
      },
    });
    await assert.rejects(() => bad.generate(f.draft, randomUUID()));
    assert.equal(f.db.sequence(f.emitter.id, 1)?.next_number, 1000);
    assert.equal(f.db.sequence(f.emitter.id, 1)?.next_code, 1);
    assert.equal(f.db.history().length, 0);
    assert.equal(f.db.errors().length, 1);
    const service = new NFeService(f.db);
    await service.generate({ ...f.draft, manualNumber: 5000 }, randomUUID());
    assert.equal(f.db.sequence(f.emitter.id, 1)?.next_number, 5001);
    await f.db.reset(f.emitter.id, 1, 3000, 5001);
    assert.equal(f.db.sequence(f.emitter.id, 1)?.next_code, 2);
    await assert.rejects(() => f.db.reset(f.emitter.id, 1, 5000, 3000));
  } finally {
    f.cleanup();
  }
});
test('recovery detects altered generated files', async () => {
  const f = await fixture();
  try {
    const a = await new NFeService(f.db).generate(f.draft, randomUUID()),
      invoice = f.db.invoice(a.id);
    const file = path.join(invoice.directory, 'nfe.xml');
    writeFileSync(file, readFileSync(file, 'utf8') + 'alterado');
    f.db.recover();
    assert.equal(f.db.invoice(a.id).status, 'ERROR');
  } finally {
    f.cleanup();
  }
});
