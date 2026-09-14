import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../src/server/repositories/store';
import {
  sampleEmitter,
  sampleRecipient,
  sampleProduct,
  sampleCfop,
} from '../src/server/sample-data';
import { draftSchema } from '../src/shared/contracts';
export async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'nfe-mock-test-')),
    db = new Store(root);
  const emitter = await db.save('emitters', sampleEmitter),
    recipient = await db.save('recipients', sampleRecipient),
    product = await db.save('products', sampleProduct);
  await db.save('cfops', sampleCfop);
  const draft = draftSchema.parse({
    emitterId: emitter.id,
    recipientId: recipient.id,
    serie: 1,
    nature: 'Venda de mercadoria',
    issueDate: '2026-09-12T10:00:00-03:00',
    cityCode: '5103403',
    items: [{ ...product, productId: product.id, quantity: '30000', cfop: '5102' }],
    transport: {},
  });
  return {
    root,
    db,
    emitter,
    recipient,
    product,
    draft,
    cleanup() {
      db.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
