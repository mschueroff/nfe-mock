import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Fields, type Field } from '../src/components/forms';

test('document fields use masks and date-time fields keep browser-native seconds', () => {
  const fields: Field[] = [
    { key: 'document', label: 'CNPJ / CPF', type: 'document', required: true },
    { key: 'issueDate', label: 'Emissão', type: 'datetime-local', required: true },
  ];
  const html = renderToStaticMarkup(
    createElement(Fields, {
      fields,
      value: {
        type: 'PJ',
        document: '93000000000172',
        issueDate: '2026-09-13T17:53:08-03:00',
      },
      onChange: () => {},
    }),
  );
  assert.match(html, /value="93\.000\.000\/0001-72"/);
  assert.match(html, /inputMode="numeric"/);
  assert.match(html, /type="datetime-local"/);
  assert.match(html, /step="1"/);
  assert.match(html, /value="2026-09-13T17:53:08"/);
  assert.equal((html.match(/required=""/g) || []).length, 2);
});
