import { entityFromEmitter, emitterSchema } from '../src/shared/contracts';
import { Store } from '../src/server/repositories/store';
import {
  sampleEmitter,
  sampleRecipient,
  sampleProduct,
  sampleCfop,
} from '../src/server/sample-data';
async function main() {
  const db = new Store();
  try {
    if (!db.raw.prepare('SELECT id FROM entities WHERE identity=?').get(sampleEmitter.cnpj))
      await db.save('entities', entityFromEmitter(emitterSchema.parse(sampleEmitter)));
    if (!db.raw.prepare('SELECT id FROM entities WHERE identity=?').get(sampleRecipient.document))
      await db.save('entities', sampleRecipient);
    if (!db.raw.prepare('SELECT id FROM cfops WHERE identity=?').get(sampleCfop.code))
      await db.save('cfops', sampleCfop);
    for (const product of [
      sampleProduct,
      {
        ...sampleProduct,
        code: 'MILHO',
        description: 'MILHO EM GRÃOS',
        ncm: '10059010',
        unitPrice: '1.20',
      },
    ])
      if (!db.raw.prepare('SELECT id FROM products WHERE identity=?').get(product.code))
        await db.save('products', product);
    console.log(
      'Seed concluído. Registros existentes preservados. CNPJs sintéticos; uso exclusivamente local.',
    );
  } finally {
    db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
