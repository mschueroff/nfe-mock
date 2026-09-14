import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Store } from '../src/server/repositories/store';
import { NFeService } from '../src/server/services/nfe';
async function main() {
  const db = new Store(process.argv[2]);
  try {
    const result = await new NFeService(db).generate(
      JSON.parse(readFileSync(process.argv[3], 'utf8')),
      randomUUID(),
    );
    process.stdout.write(JSON.stringify(result));
  } finally {
    db.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
