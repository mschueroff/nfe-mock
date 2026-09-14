import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fixture } from './fixtures';
import { Store } from '../src/server/repositories/store';
import { NFeService } from '../src/server/services/nfe';
import { sampleRecipient, SYNTHETIC_TEST_CPF } from '../src/server/sample-data';

test('unified entities switch roles, reject duplicate documents and preserve snapshots', async () => {
  const f = await fixture();
  try {
    assert.equal(f.db.list('entities').length, 2);
    const recipient = await f.db.save(
      'entities',
      {
        ...f.db.get('entities', f.recipient.id),
        stateRegistration: '131234567',
        ieIndicator: '1',
      },
      f.recipient.id,
    );
    const service = new NFeService(f.db);
    const first = await service.generate(f.draft, randomUUID());
    const second = await service.generate(
      { ...f.draft, emitterId: recipient.id, recipientId: f.emitter.id },
      randomUUID(),
    );
    assert.equal(second.number, 1);
    assert.equal(f.db.invoice(second.id).snapshot.recipient.document, f.emitter.cnpj);
    await assert.rejects(f.db.save('entities', recipient), /já cadastrado/);
    await f.db.save('entities', { ...recipient, name: 'NOME ATUALIZADO' }, recipient.id);
    assert.equal(f.db.invoice(first.id).snapshot.recipient.name, sampleRecipient.name);
    assert.equal(f.db.get('emitters', recipient.id).corporateName, 'NOME ATUALIZADO');
    const person = await f.db.save('entities', {
      ...sampleRecipient,
      type: 'PF',
      document: SYNTHETIC_TEST_CPF,
    });
    assert.throws(() => service.preview({ ...f.draft, emitterId: person.id }), /IE deve/);
    await f.db.remove('entities', recipient.id);
    assert.throws(() => f.db.get('recipients', recipient.id), /excluído/);
    assert.ok(service.file(first.id, 'xml').content.length);
  } finally {
    f.cleanup();
  }
});

test('v1 migration unifies documents and preserves sequences, files and legacy references', async () => {
  const f = await fixture();
  let reopened: Store | undefined;
  try {
    const generated = await new NFeService(f.db).generate(f.draft, randomUUID());
    const original = f.db.invoice(generated.id);
    const xml = new NFeService(f.db).file(generated.id, 'xml').content;
    // Reconstruct the previous registry layout around a real generated invoice.
    f.db.raw.pragma('foreign_keys = OFF');
    const initial = readFileSync('db/0001_initial.sql', 'utf8').split('\n');
    f.db.raw.exec(initial.slice(0, 2).join('\n'));
    const now = new Date().toISOString();
    f.db.raw
      .prepare('INSERT INTO emitters VALUES(?,?,?,?,?,?,?)')
      .run(
        f.emitter.id,
        f.emitter.cnpj,
        f.emitter.corporateName,
        JSON.stringify(f.emitter),
        null,
        now,
        now,
      );
    const addRecipient = f.db.raw.prepare('INSERT INTO recipients VALUES(?,?,?,?,?,?,?)');
    addRecipient.run(
      f.recipient.id,
      f.recipient.document,
      f.recipient.name,
      JSON.stringify(f.recipient),
      null,
      now,
      now,
    );
    const oldDuplicateId = randomUUID();
    const oldDuplicate = {
      ...sampleRecipient,
      document: f.emitter.cnpj,
      name: 'NOME DO CADASTRO ANTIGO',
      email: 'qa@example.test',
    };
    addRecipient.run(
      oldDuplicateId,
      oldDuplicate.document,
      oldDuplicate.name,
      JSON.stringify(oldDuplicate),
      null,
      now,
      now,
    );
    // A historical recipient reference can point to a duplicate entity registration.
    f.db.raw
      .prepare('UPDATE invoices SET recipient_id=? WHERE id=?')
      .run(oldDuplicateId, generated.id);
    f.db.raw.exec(
      'DROP TABLE entity_migration_sources; DROP TABLE entities; DROP TABLE cfops; PRAGMA user_version=1;',
    );
    f.db.close();
    reopened = new Store(f.root);
    assert.equal(reopened.raw.pragma('user_version', { simple: true }), 3);
    assert.equal(reopened.list('entities').length, 2);
    assert.equal(reopened.get('recipients', oldDuplicateId).id, f.emitter.id);
    assert.equal(reopened.get('entities', f.emitter.id).email, 'qa@example.test');
    assert.equal(reopened.sequence(f.emitter.id, 1)?.next_number, 1001);
    assert.deepEqual(reopened.raw.pragma('foreign_key_check'), []);
    assert.equal(
      reopened.raw
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('emitters','recipients')",
        )
        .all().length,
      0,
    );
    const migrated = reopened.invoice(generated.id);
    assert.equal(migrated.recipientId, f.emitter.id);
    assert.deepEqual(migrated.snapshot, original.snapshot);
    assert.deepEqual(new NFeService(reopened).file(generated.id, 'xml').content, xml);
    assert.equal(new NFeService(reopened).duplicate(generated.id).recipientId, f.emitter.id);
    const source = reopened.raw
      .prepare('SELECT original_data FROM entity_migration_sources WHERE legacy_id=?')
      .get(oldDuplicateId) as { original_data: string };
    assert.equal(JSON.parse(source.original_data).name, oldDuplicate.name);
    reopened.close();
    reopened = new Store(f.root);
    assert.equal(reopened.list('entities').length, 2);
  } finally {
    reopened?.close();
    if (!f.db.raw.open) {
      const { rmSync } = await import('node:fs');
      rmSync(f.root, { recursive: true, force: true });
    } else f.cleanup();
  }
});
