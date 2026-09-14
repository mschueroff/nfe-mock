import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { fixture } from './fixtures';
import { Store } from '../src/server/repositories/store';
import { NFeService } from '../src/server/services/nfe';

test('products remain independent from CFOP across operations, deletion and snapshots', async () => {
  const f = await fixture();
  try {
    assert.equal(f.db.get('products', f.product.id).cfop, undefined);
    const other = await f.db.save('cfops', {
      code: '5905',
      description: 'Operação alternativa de teste',
    });
    const service = new NFeService(f.db);
    const first = await service.generate(f.draft, randomUUID());
    const draft = {
      ...f.draft,
      nature: 'Outra operação de teste',
      items: f.draft.items.map((item) => ({ ...item, cfop: other.code })),
    };
    const second = await service.generate(draft, randomUUID());
    assert.match(service.file(first.id, 'xml').content.toString(), /<CFOP>5102<\/CFOP>/);
    assert.match(service.file(second.id, 'xml').content.toString(), /<CFOP>5905<\/CFOP>/);
    assert.equal(f.db.invoice(second.id).snapshot.items[0].productId, f.product.id);
    assert.equal(f.db.get('products', f.product.id).cfop, undefined);
    assert.throws(
      () => service.preview({ ...draft, items: [{ ...draft.items[0], cfop: '5906' }] }),
      /cadastrado e ativo/,
    );
    await f.db.save('cfops', { code: '6905', description: 'Interestadual de teste' });
    assert.throws(
      () => service.preview({ ...draft, items: [{ ...draft.items[0], cfop: '6905' }] }),
      /incompatível/,
    );
    await f.db.remove('cfops', other.id);
    assert.throws(() => service.preview(draft), /cadastrado e ativo/);
    assert.equal(service.duplicate(second.id).items[0].cfop, '5905');
    assert.match(service.file(second.id, 'xml').content.toString(), /<CFOP>5905<\/CFOP>/);
  } finally {
    f.cleanup();
  }
});

test('v2 migration extracts CFOPs without changing product and invoice history', async () => {
  const f = await fixture();
  let reopened: Store | undefined;
  try {
    const result = await new NFeService(f.db).generate(f.draft, randomUUID());
    const snapshot = f.db.invoice(result.id).snapshot;
    f.db.raw
      .prepare('UPDATE products SET data=? WHERE id=?')
      .run(JSON.stringify({ ...f.product, cfop: '5905' }), f.product.id);
    f.db.raw.exec('DROP TABLE cfops; PRAGMA user_version=2;');
    f.db.close();
    reopened = new Store(f.root);
    assert.equal(reopened.raw.pragma('user_version', { simple: true }), 3);
    assert.deepEqual(
      reopened
        .list('cfops')
        .map((row) => row.code)
        .sort(),
      ['5102', '5905'],
    );
    assert.equal(reopened.get('products', f.product.id).cfop, undefined);
    assert.deepEqual(reopened.invoice(result.id).snapshot, snapshot);
    assert.match(
      new NFeService(reopened).file(result.id, 'xml').content.toString(),
      /<CFOP>5102<\/CFOP>/,
    );
    reopened.close();
    reopened = new Store(f.root);
    assert.equal(reopened.list('cfops').length, 2);
  } finally {
    reopened?.close();
    if (f.db.raw.open) f.cleanup();
    else rmSync(f.root, { recursive: true, force: true });
  }
});
