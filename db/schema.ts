import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};
export const entities = sqliteTable('entities', {
  id: text('id').primaryKey(),
  identity: text('identity').notNull().unique(),
  name: text('name').notNull(),
  data: text('data').notNull(),
  deletedAt: text('deleted_at'),
  ...timestamps,
});
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  identity: text('identity').notNull().unique(),
  name: text('name').notNull(),
  data: text('data').notNull(),
  deletedAt: text('deleted_at'),
  ...timestamps,
});
export const cfops = sqliteTable('cfops', {
  id: text('id').primaryKey(),
  identity: text('identity').notNull().unique(),
  name: text('name').notNull(),
  data: text('data').notNull(),
  deletedAt: text('deleted_at'),
  ...timestamps,
});
export const sequences = sqliteTable(
  'sequences',
  {
    id: text('id').primaryKey(),
    emitterId: text('emitter_id')
      .notNull()
      .references(() => entities.id),
    serie: integer('serie').notNull(),
    nextNumber: integer('next_number').notNull(),
    nextCode: integer('next_code').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('sequence_emitter_serie').on(t.emitterId, t.serie)],
);
export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    emitterId: text('emitter_id')
      .notNull()
      .references(() => entities.id),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => entities.id),
    serie: integer('serie').notNull(),
    number: integer('number').notNull(),
    accessKey: text('access_key').notNull().unique(),
    numericCode: text('numeric_code').notNull(),
    checkDigit: text('check_digit').notNull(),
    issueDate: text('issue_date').notNull(),
    total: text('total').notNull(),
    status: text('status').notNull(),
    sourceInvoiceId: text('source_invoice_id'),
    snapshot: text('snapshot').notNull(),
    directory: text('directory').notNull(),
    xmlHash: text('xml_hash').notNull(),
    pdfHash: text('pdf_hash').notNull(),
    schemaProfile: text('schema_profile').notNull(),
    validation: text('validation').notNull(),
    requestId: text('request_id').notNull().unique(),
    requestHash: text('request_hash').notNull(),
    deletedAt: text('deleted_at'),
    ...timestamps,
  },
  (t) => [uniqueIndex('invoice_emitter_serie_number').on(t.emitterId, t.serie, t.number)],
);
export const invoiceItems = sqliteTable('invoice_items', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  itemNumber: integer('item_number').notNull(),
  snapshot: text('snapshot').notNull(),
});
export const attempts = sqliteTable('generation_attempts', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull(),
  stage: text('stage').notNull(),
  message: text('message').notNull(),
  draft: text('draft').notNull(),
  createdAt: text('created_at').notNull(),
});
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  data: text('data').notNull(),
});
