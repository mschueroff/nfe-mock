// Run only against a disposable database/container: creates fictitious records.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import {
  sampleEmitter,
  sampleRecipient,
  sampleProduct,
  sampleCfop,
} from '../src/server/sample-data';
import { draftSchema } from '../src/shared/contracts';
async function main() {
  const base = process.env.NFE_TEST_URL;
  if (!base)
    throw new Error('Defina NFE_TEST_URL apontando para uma instância descartável de teste.');
  async function call(
    route: string,
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const result = await fetch(base + '/api/' + route, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: new URL(base!).origin, ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await result.json();
    assert.ok(result.ok, JSON.stringify(data));
    return data;
  }
  assert.equal((await call('health')).status, 'ok');
  const emitter = (await call('emitters'))[0] || (await call('emitters', 'POST', sampleEmitter)),
    recipient =
      (await call('recipients'))[0] || (await call('recipients', 'POST', sampleRecipient)),
    product = (await call('products'))[0] || (await call('products', 'POST', sampleProduct));
  if (!(await call('cfops')).some((cfop: any) => cfop.code === sampleCfop.code))
    await call('cfops', 'POST', sampleCfop);
  const draft = draftSchema.parse({
    emitterId: emitter.id,
    recipientId: recipient.id,
    serie: 1,
    issueDate: '2026-09-12T10:00:00-03:00',
    cityCode: '5103403',
    items: [{ ...product, productId: product.id, quantity: '30000', cfop: '5102' }],
    transport: {},
  });
  const before = await call(`sequences/${emitter.id}?serie=1`),
    request = randomUUID(),
    preview = await call('invoices/preview', 'POST', draft);
  assert.equal(preview.number, before.next_number);
  const first = await call('invoices', 'POST', draft, { 'Idempotency-Key': request });
  assert.equal(first.number, before.next_number);
  const replay = await call('invoices', 'POST', draft, { 'Idempotency-Key': request });
  assert.equal(replay.id, first.id);
  const response = await fetch(`${base}/api/invoices/${first.id}/files?format=zip`);
  assert.equal(response.status, 200);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  assert.ok((await zip.file('nfe.xml')!.async('string')).includes(first.accessKey));
  assert.equal(
    (await zip.file('danfe.pdf')!.async('nodebuffer')).subarray(0, 5).toString(),
    '%PDF-',
  );
  const after = await call(`sequences/${emitter.id}?serie=1`);
  assert.equal(after.next_number, before.next_number + 1);
  console.log(
    JSON.stringify({
      http: 'passed',
      number: first.number,
      id: first.id,
      accessKey: first.accessKey,
      next: after.next_number,
      history: (await call('invoices')).invoices.length,
    }),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
