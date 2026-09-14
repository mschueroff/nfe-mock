import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, desc, isNull } from 'drizzle-orm';
import { mkdirSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import * as tables from '../../../db/schema';
import {
  emitterSchema,
  entitySchema,
  entityFromEmitter,
  entityAsEmitter,
  recipientSchema,
  productSchema,
  cfopSchema,
  settingsSchema,
  type Settings,
} from '../../shared/contracts';
import { AppError } from '../errors';
import { migrateEntities, migrateCfops } from './migrate';

export const catalogNames = ['entities', 'emitters', 'recipients', 'products', 'cfops'] as const;
export type CatalogName = (typeof catalogNames)[number];
const schemas = {
  entities: entitySchema,
  emitters: emitterSchema,
  recipients: recipientSchema,
  products: productSchema,
  cfops: cfopSchema,
};
export const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export class Store {
  raw: Database.Database;
  db: ReturnType<typeof drizzle<typeof tables>>;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    public root = path.resolve(/*turbopackIgnore: true*/ process.env.NFE_DATA_DIR || 'data'),
  ) {
    mkdirSync(root, { recursive: true });
    this.raw = new Database(path.join(root, 'nfe-mock.sqlite'));
    this.raw.pragma('journal_mode = WAL');
    this.raw.pragma('foreign_keys = ON');
    this.raw.pragma('busy_timeout = 5000');
    const version = this.raw.pragma('user_version', { simple: true });
    if (version === 0)
      this.raw.transaction(() =>
        this.raw.exec(readFileSync(path.resolve('db/0001_initial.sql'), 'utf8')),
      )();
    else if (version !== 1 && version !== 2 && version !== 3)
      throw new AppError(
        'DATABASE_VERSION',
        'Banco criado por uma versão incompatível da aplicação',
        500,
      );
    if (this.raw.pragma('user_version', { simple: true }) === 1) migrateEntities(this.raw);
    if (this.raw.pragma('user_version', { simple: true }) === 2) migrateCfops(this.raw);
    this.db = drizzle(this.raw, { schema: tables });
    this.db
      .insert(tables.settings)
      .values({ id: 1, data: JSON.stringify(this.defaults()) })
      .onConflictDoNothing()
      .run();
    this.recover();
  }
  defaults(): Settings {
    return {
      storageDirectory: path.join(this.root, 'nfe'),
      environment: '2',
      numericCodeMode: 'SEQUENTIAL',
      openDanfe: false,
      prettyXml: true,
      validateXsd: true,
    };
  }
  settings(): Settings {
    return JSON.parse(this.db.select().from(tables.settings).get()!.data);
  }
  write<T>(fn: () => T | Promise<T>): Promise<T> {
    const next = this.tail.then(fn);
    this.tail = next.catch(() => {});
    return next;
  }
  async updateSettings(value: unknown) {
    return this.write(() => {
      const data = settingsSchema.parse(value);
      data.storageDirectory = path.resolve(data.storageDirectory);
      if (data.storageDirectory === path.parse(data.storageDirectory).root)
        throw new AppError('INVALID_DIRECTORY', 'Selecione um subdiretório para os arquivos');
      mkdirSync(data.storageDirectory, { recursive: true });
      this.db
        .update(tables.settings)
        .set({ data: JSON.stringify(data) })
        .where(eq(tables.settings.id, 1))
        .run();
      return data;
    });
  }
  list(kind: CatalogName) {
    return this.db
      .select()
      .from(tables[kind === 'products' || kind === 'cfops' ? kind : 'entities'])
      .where(isNull(tables[kind === 'products' || kind === 'cfops' ? kind : 'entities'].deletedAt))
      .orderBy(desc(tables[kind === 'products' || kind === 'cfops' ? kind : 'entities'].updatedAt))
      .all()
      .map(this.decode)
      .filter((data) => kind !== 'emitters' || data.stateRegistration)
      .map((data) => this.role(kind, data));
  }
  private canonicalId(kind: CatalogName, id: string) {
    if (kind !== 'emitters' && kind !== 'recipients') return id;
    const alias = this.raw
      .prepare('SELECT entity_id FROM entity_migration_sources WHERE kind=? AND legacy_id=?')
      .get(kind, id) as { entity_id: string } | undefined;
    return alias?.entity_id || id;
  }
  private role(kind: CatalogName, data: any) {
    if (kind === 'emitters') {
      return { ...data, ...entityAsEmitter(data) };
    }
    return data;
  }
  get(kind: CatalogName, id: string, includeDeleted = false) {
    id = this.canonicalId(kind, id);
    const row = this.db
      .select()
      .from(tables[kind === 'products' || kind === 'cfops' ? kind : 'entities'])
      .where(eq(tables[kind === 'products' || kind === 'cfops' ? kind : 'entities'].id, id))
      .get();
    if (!row || (!includeDeleted && row.deletedAt))
      throw new AppError('NOT_FOUND', 'Cadastro não encontrado ou excluído', 404);
    return this.role(kind, this.decode(row));
  }
  private decode(row: {
    data: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  }) {
    return {
      ...JSON.parse(row.data),
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }
  async save(kind: CatalogName, value: unknown, id?: string) {
    return this.write(() =>
      this.raw.transaction(() => {
        if (id) id = this.canonicalId(kind, id);
        const parsed = schemas[kind].parse(value);
        const data =
          kind === 'emitters'
            ? entitySchema.parse({
                ...(id ? this.get('entities', id) : {}),
                ...entityFromEmitter(parsed as Parameters<typeof entityFromEmitter>[0]),
                ...(id ? { email: this.get('entities', id).email } : {}),
              })
            : kind === 'recipients'
              ? entitySchema.parse({ ...(id ? this.get('entities', id) : {}), ...parsed })
              : parsed;
        if (id) {
          const previous = this.get(
            kind === 'products' || kind === 'cfops' ? kind : 'entities',
            id,
          );
          if (
            kind !== 'products' &&
            previous.document !== ('document' in data ? data.document : '') &&
            this.db.select().from(tables.invoices).where(eq(tables.invoices.emitterId, id)).get()
          )
            throw new AppError(
              'IMMUTABLE_CNPJ',
              'CPF/CNPJ não pode ser alterado após gerar uma NF-e',
              409,
            );
        }
        const identity =
          'cnpj' in data ? data.cnpj : 'document' in data ? data.document : data.code;
        const name =
          'corporateName' in data
            ? data.corporateName
            : 'name' in data
              ? data.name
              : data.description;
        const now = new Date().toISOString(),
          key = id || randomUUID();
        const values = { identity, name, data: JSON.stringify(data), updatedAt: now };
        try {
          if (id)
            this.db
              .update(tables[kind === 'products' || kind === 'cfops' ? kind : 'entities'])
              .set(values)
              .where(eq(tables[kind === 'products' || kind === 'cfops' ? kind : 'entities'].id, id))
              .run();
          else
            this.db
              .insert(tables[kind === 'products' || kind === 'cfops' ? kind : 'entities'])
              .values({ ...values, id: key, createdAt: now })
              .run();
          if (kind !== 'products' && 'type' in data) {
            const entity = entitySchema.parse(data);
            this.db
              .insert(tables.sequences)
              .values({
                id: randomUUID(),
                emitterId: key,
                serie: entity.defaultSerie,
                nextNumber: entity.initialNumber,
                nextCode: 1,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoNothing()
              .run();
          }
        } catch (e) {
          if (String(e).includes('UNIQUE'))
            throw new AppError(
              'DUPLICATE',
              'Documento ou código já cadastrado, inclusive em registros excluídos',
              409,
            );
          throw e;
        }
        return this.get(kind, key);
      })(),
    );
  }
  async remove(kind: CatalogName, id: string) {
    return this.write(() => {
      id = this.canonicalId(kind, id);
      this.get(kind, id);
      const now = new Date().toISOString();
      this.db
        .update(tables[kind === 'products' || kind === 'cfops' ? kind : 'entities'])
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(tables[kind === 'products' || kind === 'cfops' ? kind : 'entities'].id, id))
        .run();
      return { ok: true };
    });
  }
  sequence(emitterId: string, serie: number) {
    return this.raw
      .prepare('SELECT * FROM sequences WHERE emitter_id=? AND serie=?')
      .get(emitterId, serie) as { id: string; next_number: number; next_code: number } | undefined;
  }
  async reset(emitterId: string, serie: number, nextNumber: number, expected: number) {
    return this.write(() =>
      this.raw.transaction(() => {
        this.get('emitters', emitterId);
        const current = this.sequence(emitterId, serie);
        if ((current?.next_number ?? 1) !== expected)
          throw new AppError(
            'STALE_SEQUENCE',
            'A sequência mudou. Atualize a tela antes de confirmar',
            409,
          );
        if (
          this.raw
            .prepare('SELECT id FROM invoices WHERE emitter_id=? AND serie=? AND number=?')
            .get(emitterId, serie, nextNumber)
        )
          throw new AppError('DUPLICATE_NUMBER', 'Este número já foi utilizado', 409);
        const now = new Date().toISOString();
        this.raw
          .prepare(
            'INSERT INTO sequences VALUES(?,?,?,?,?,?,?) ON CONFLICT(emitter_id,serie) DO UPDATE SET next_number=excluded.next_number,updated_at=excluded.updated_at',
          )
          .run(randomUUID(), emitterId, serie, nextNumber, 1, now, now);
        return this.sequence(emitterId, serie);
      })(),
    );
  }
  invoice(id: string) {
    const row = this.db.select().from(tables.invoices).where(eq(tables.invoices.id, id)).get();
    if (!row || row.deletedAt) throw new AppError('NOT_FOUND', 'NF-e não encontrada', 404);
    return { ...row, snapshot: JSON.parse(row.snapshot) };
  }
  history() {
    return this.db
      .select()
      .from(tables.invoices)
      .where(isNull(tables.invoices.deletedAt))
      .orderBy(desc(tables.invoices.createdAt))
      .all()
      .map((row) => {
        const s = JSON.parse(row.snapshot);
        return {
          ...row,
          snapshot: undefined,
          emitterName: s.emitter.corporateName,
          emitterCnpj: s.emitter.cpf || s.emitter.cnpj,
          recipientName: s.recipient.name,
        };
      });
  }
  errors() {
    return this.db
      .select()
      .from(tables.attempts)
      .orderBy(desc(tables.attempts.createdAt))
      .limit(100)
      .all()
      .map((v) => ({ ...v, status: 'ERROR', draft: undefined }));
  }
  async changeInvoice(id: string, action: 'delete' | 'cancel') {
    return this.write(() => {
      const old = this.invoice(id);
      if (action === 'cancel' && old.status === 'ERROR')
        throw new AppError('INVALID_STATUS', 'Arquivos inconsistentes: consulte o diagnóstico');
      const now = new Date().toISOString();
      this.db
        .update(tables.invoices)
        .set(
          action === 'delete'
            ? { deletedAt: now, updatedAt: now }
            : { status: 'CANCELLED_TEST', updatedAt: now },
        )
        .where(eq(tables.invoices.id, id))
        .run();
      return { ok: true };
    });
  }
  recover() {
    this.raw.exec('BEGIN IMMEDIATE');
    try {
      const rows = this.db.select().from(tables.invoices).all();
      const known = new Set(rows.map((r) => r.directory));
      for (const row of rows) {
        const xml = path.join(row.directory, 'nfe.xml'),
          pdf = path.join(row.directory, 'danfe.pdf');
        if (
          !existsSync(xml) ||
          !existsSync(pdf) ||
          sha(readFileSync(xml)) !== row.xmlHash ||
          sha(readFileSync(pdf)) !== row.pdfHash
        )
          this.db
            .update(tables.invoices)
            .set({ status: 'ERROR', updatedAt: new Date().toISOString() })
            .where(eq(tables.invoices.id, row.id))
            .run();
      }
      // Only directories carrying our marker are managed; never follow symlinks.
      const walk = (directory: string, depth: number) => {
        if (!existsSync(directory) || depth > 6) return;
        if (existsSync(path.join(directory, '.nfe-mock.json')) && !known.has(directory)) {
          let marker;
          try {
            marker = JSON.parse(readFileSync(path.join(directory, '.nfe-mock.json'), 'utf8'));
          } catch {
            return;
          }
          if (marker.database === path.join(this.root, 'nfe-mock.sqlite')) {
            rmSync(directory, { recursive: true, force: true });
            return;
          }
        }
        for (const entry of readdirSync(directory, { withFileTypes: true }))
          if (entry.isDirectory() && !entry.isSymbolicLink())
            walk(path.join(directory, entry.name), depth + 1);
      };
      for (const root of new Set([
        this.settings().storageDirectory,
        ...rows.map((r) => path.resolve(r.directory, '../../../..')),
      ]))
        walk(root, 0);
      this.raw.exec('COMMIT');
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }
  close() {
    this.raw.close();
  }
}
const globalStore = globalThis as unknown as { nfeMockStore?: Store };
export function store() {
  return (globalStore.nfeMockStore ??= new Store());
}
