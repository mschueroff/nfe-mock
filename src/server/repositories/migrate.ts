import type Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { entitySchema, entityFromEmitter } from '../../shared/contracts';

type LegacyRow = {
  id: string;
  identity: string;
  name: string;
  data: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export function migrateEntities(db: Database.Database) {
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      if (db.pragma('user_version', { simple: true }) === 2) return;
      db.exec(`CREATE TABLE entities(id TEXT PRIMARY KEY, identity TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL, data TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE entity_migration_sources(kind TEXT NOT NULL, legacy_id TEXT NOT NULL,
          entity_id TEXT NOT NULL REFERENCES entities(id), original_data TEXT NOT NULL,
          PRIMARY KEY(kind, legacy_id));`);
      const insert = db.prepare('INSERT INTO entities VALUES(?,?,?,?,?,?,?)');
      for (const kind of ['emitters', 'recipients'] as const) {
        const rows = db
          .prepare(`SELECT * FROM ${kind} ORDER BY deleted_at IS NOT NULL, created_at, id`)
          .all() as LegacyRow[];
        for (const row of rows) {
          const original = JSON.parse(row.data);
          const data =
            kind === 'emitters' ? entityFromEmitter(original) : entitySchema.parse(original);
          const existing = db
            .prepare('SELECT * FROM entities WHERE identity=?')
            .get(data.document) as LegacyRow | undefined;
          const id = existing?.id || row.id;
          if (!existing)
            insert.run(
              id,
              data.document,
              data.name,
              JSON.stringify(data),
              row.deleted_at,
              row.created_at,
              row.updated_at,
            );
          else {
            // Issuer fiscal settings take precedence. Retain every original in the migration audit.
            const merged = JSON.parse(existing.data);
            if (!merged.email) merged.email = data.email;
            db.prepare('UPDATE entities SET data=?, deleted_at=? WHERE id=?').run(
              JSON.stringify(merged),
              existing.deleted_at && row.deleted_at ? existing.deleted_at : null,
              id,
            );
          }
          db.prepare('INSERT INTO entity_migration_sources VALUES(?,?,?,?)').run(
            kind,
            row.id,
            id,
            row.data,
          );
        }
      }
      for (const table of ['sequences', 'invoices', 'invoice_items'])
        db.exec(`CREATE TEMP TABLE ${table}_v1 AS SELECT * FROM ${table}`);
      db.exec(
        'DROP TABLE invoice_items; DROP TABLE invoices; DROP TABLE sequences; DROP TABLE recipients; DROP TABLE emitters;',
      );
      db.exec(readFileSync(path.resolve('db/0002_entities.sql'), 'utf8'));
      db.exec(`UPDATE invoices_v1 SET recipient_id=(SELECT entity_id FROM entity_migration_sources
        WHERE kind='recipients' AND legacy_id=invoices_v1.recipient_id);
        INSERT INTO sequences SELECT * FROM sequences_v1;
        INSERT INTO invoices SELECT * FROM invoices_v1;
        INSERT INTO invoice_items SELECT * FROM invoice_items_v1;
        DROP TABLE sequences_v1; DROP TABLE invoices_v1; DROP TABLE invoice_items_v1;`);
      if ((db.pragma('foreign_key_check') as unknown[]).length)
        throw new Error('Falha de integridade na migração de entidades');
      db.pragma('user_version = 2');
    }).immediate();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

export function migrateCfops(db: Database.Database) {
  db.transaction(() => {
    if (db.pragma('user_version', { simple: true }) === 3) return;
    db.exec(`CREATE TABLE IF NOT EXISTS cfops(id TEXT PRIMARY KEY, identity TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL, data TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    const codes = new Set<string>();
    const products = db.prepare('SELECT id, data FROM products').all() as {
      id: string;
      data: string;
    }[];
    for (const row of products) {
      const product = JSON.parse(row.data);
      if (product.cfop) codes.add(product.cfop);
      delete product.cfop;
      db.prepare('UPDATE products SET data=? WHERE id=?').run(JSON.stringify(product), row.id);
    }
    for (const row of db.prepare('SELECT snapshot FROM invoice_items').all() as {
      snapshot: string;
    }[]) {
      const item = JSON.parse(row.snapshot);
      if (item.cfop) codes.add(item.cfop);
    }
    const now = new Date().toISOString();
    for (const code of codes) {
      const description = `CFOP ${code} (migrado; revise a descrição)`;
      db.prepare('INSERT OR IGNORE INTO cfops VALUES(?,?,?,?,?,?,?)').run(
        randomUUID(),
        code,
        description,
        JSON.stringify({ code, description }),
        null,
        now,
        now,
      );
    }
    db.pragma('user_version = 3');
  }).immediate();
}
