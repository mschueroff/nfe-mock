import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { NextRequest } from 'next/server';
import {
  sampleEmitter,
  sampleRecipient,
  sampleProduct,
  sampleCfop,
} from '../src/server/sample-data';
import { draftSchema, entityFromEmitter, emitterSchema } from '../src/shared/contracts';
import { store } from '../src/server/repositories/store';
import { GET, POST, PUT, DELETE } from '../src/app/api/[...route]/route';
test('complete API contract covers catalogs, generation, ZIP, errors and origins', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'nfe-mock-api-'));
  process.env.NFE_DATA_DIR = root;
  async function request(
    route: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const url = new URL('/api/' + route, 'http://127.0.0.1:3010');
    const req = new NextRequest(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { GET, POST, PUT, DELETE }[method](req, {
      params: Promise.resolve({ route: url.pathname.slice(5).split('/') }),
    });
  }
  try {
    assert.equal((await request('emitters', 'POST', {})).status, 422);
    assert.equal(
      (await request('emitters', 'POST', sampleEmitter, { Origin: 'https://example.org' })).status,
      403,
    );
    const emitter = await (
      await request('entities', 'POST', entityFromEmitter(emitterSchema.parse(sampleEmitter)))
    ).json();
    const recipient = await (await request('entities', 'POST', sampleRecipient)).json();
    const product = await (await request('products', 'POST', sampleProduct)).json();
    assert.equal((await (await request('entities')).json()).length, 2);
    assert.equal((await (await request('dashboard')).json()).counts.entities, 2);
    assert.equal((await request('cfops', 'POST', sampleCfop)).status, 201);
    assert.equal((await (await request('cfops')).json()).length, 1);
    assert.equal(product.cfop, undefined);
    const draft = draftSchema.parse({
      emitterId: emitter.id,
      recipientId: recipient.id,
      serie: 1,
      issueDate: '2026-09-12T10:00:00-03:00',
      cityCode: '5103403',
      items: [{ ...product, productId: product.id, quantity: '30000', cfop: '5102' }],
      transport: {},
    });
    const preview = await (await request('invoices/preview', 'POST', draft)).json();
    assert.equal(preview.number, 1000);
    assert.equal(preview.totals.total, '63000.00');
    const header = { 'Idempotency-Key': randomUUID() },
      result = await request('invoices', 'POST', draft, header);
    assert.equal(result.status, 201);
    const generated = await result.json();
    assert.equal(
      (await (await request('invoices', 'POST', draft, header)).json()).id,
      generated.id,
    );
    const xml = await request(`invoices/${generated.id}/files?format=xml`);
    assert.match(xml.headers.get('Content-Type')!, /application\/xml/);
    assert.ok((await xml.text()).includes(generated.accessKey));
    const zip = await JSZip.loadAsync(
      await (await request(`invoices/${generated.id}/files?format=zip`)).arrayBuffer(),
    );
    assert.deepEqual(Object.keys(zip.files), ['nfe.xml', 'danfe.pdf']);
    assert.equal((await request(`invoices/${generated.id}/files?format=../foo`)).status, 422);
    const copy = await (await request(`invoices/${generated.id}/duplicate?substitute=true`)).json();
    assert.equal(copy.sourceInvoiceId, generated.id);
    assert.equal(copy.manualNumber, '');
    await request(`invoices/${generated.id}/cancel`, 'POST', {});
    assert.equal(
      (await (await request(`invoices/${generated.id}`)).json()).status,
      'CANCELLED_TEST',
    );
    await request(`products/${product.id}`, 'DELETE', {});
    assert.equal((await request(`products/${product.id}`)).status, 404);
    assert.equal((await request(`invoices/${generated.id}`)).status, 200);
  } finally {
    store().close();
    delete (globalThis as any).nfeMockStore;
    delete process.env.NFE_DATA_DIR;
    rmSync(root, { recursive: true, force: true });
  }
});
