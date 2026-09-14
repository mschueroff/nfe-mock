import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixtures';
import { NFeService } from '../src/server/services/nfe';
import { Store } from '../src/server/repositories/store';
import { NFeSequenceService } from '../src/server/services/sequence';
import { draftSchema, emitterSchema } from '../src/shared/contracts';
test('XML, XSD, filesystem and persistence failures do not consume sequence numbers', async () => {
  for (const failure of ['xml', 'xsd', 'files', 'persist']) {
    const f = await fixture();
    try {
      let service = new NFeService(f.db);
      if (failure === 'xml')
        service = new NFeService(f.db, {
          generate() {
            throw new Error('Falha XML');
          },
        });
      if (failure === 'xsd')
        service = new NFeService(f.db, {
          generate() {
            return '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"/>';
          },
        });
      if (failure === 'files')
        writeFileSync(
          f.db.settings().storageDirectory,
          'Simula um caminho indisponível para diretório',
        );
      if (failure === 'persist')
        f.db.raw.exec(
          "CREATE TRIGGER fail_invoice BEFORE INSERT ON invoices BEGIN SELECT RAISE(ABORT,'Simulated disk/database failure'); END",
        );
      await assert.rejects(() => service.generate(f.draft, randomUUID()));
      assert.equal(f.db.sequence(f.emitter.id, 1)?.next_number, 1000, failure);
      assert.equal(f.db.sequence(f.emitter.id, 1)?.next_code, 1, failure);
      assert.equal(f.db.history().length, 0, failure);
      assert.equal(f.db.errors().length, 1, failure);
      if (failure === 'persist') {
        const walk = (folder: string): string[] =>
          readdirSync(folder, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? walk(path.join(folder, e.name)) : [e.name],
          );
        assert.ok(!walk(f.db.settings().storageDirectory).includes('nfe.xml'));
      }
    } finally {
      f.cleanup();
    }
  }
});
test('file conflicts do not remove a pre-existing directory', async () => {
  const f = await fixture();
  try {
    const service = new NFeService(f.db),
      preview = service.preview(f.draft),
      directory = path.join(
        f.db.settings().storageDirectory,
        f.emitter.cnpj,
        '2026',
        '09',
        preview.accessKey,
      );
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, '.nfe-mock.json'),
      JSON.stringify({ database: 'another-database' }),
    );
    writeFileSync(path.join(directory, 'sentinel'), 'preserve');
    await assert.rejects(() => service.generate(f.draft, randomUUID()));
    assert.ok(existsSync(path.join(directory, 'sentinel')));
    assert.equal(f.db.sequence(f.emitter.id, 1)?.next_number, 1000);
  } finally {
    f.cleanup();
  }
});
test('restart cleanup removes only database-marked orphan directories', async () => {
  const f = await fixture();
  try {
    const root = f.db.settings().storageDirectory,
      orphan = path.join(root, f.emitter.cnpj, '2026', '09', 'orphan.tmp-request'),
      unmanaged = path.join(root, 'unmanaged');
    mkdirSync(orphan, { recursive: true });
    mkdirSync(unmanaged, { recursive: true });
    writeFileSync(
      path.join(orphan, '.nfe-mock.json'),
      JSON.stringify({ database: path.join(f.root, 'nfe-mock.sqlite') }),
    );
    const restarted = new Store(f.root);
    restarted.close();
    assert.equal(existsSync(orphan), false);
    assert.equal(existsSync(unmanaged), true);
    assert.equal(f.db.sequence(f.emitter.id, 1)?.next_number, 1000);
  } finally {
    f.cleanup();
  }
});
test('independent processes do not allocate duplicate invoice numbers', async () => {
  const f = await fixture();
  try {
    const file = path.join(f.root, 'draft.json');
    writeFileSync(file, JSON.stringify(f.draft));
    const run = () =>
      new Promise<any>((resolve, reject) => {
        const p = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/concurrency-worker.ts', f.root, file],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        let out = '',
          err = '';
        p.stdout.on('data', (v) => (out += v));
        p.stderr.on('data', (v) => (err += v));
        p.on('error', reject);
        p.on('exit', (code) => {
          if (code !== 0) reject(new Error(err));
          else {
            try {
              resolve(JSON.parse(out));
            } catch (e) {
              reject(e);
            }
          }
        });
      });
    const results = await Promise.all([run(), run()]);
    assert.deepEqual(results.map((r) => r.number).sort(), [1000, 1001]);
    assert.equal(new Set(results.map((r) => r.accessKey)).size, 2);
    assert.equal(f.db.sequence(f.emitter.id, 1)?.next_number, 1002);
  } finally {
    f.cleanup();
  }
});
test('invalid dates, alphanumeric CNPJ and non-transactional reservations are rejected', async () => {
  const f = await fixture();
  try {
    assert.throws(() => draftSchema.parse({ ...f.draft, issueDate: '2026-02-30T10:00:00-03:00' }));
    assert.throws(() => emitterSchema.parse({ ...f.emitter, cnpj: 'A' + f.emitter.cnpj }));
    assert.throws(() => new NFeSequenceService(f.db).reserve(f.draft, f.emitter));
  } finally {
    f.cleanup();
  }
});
