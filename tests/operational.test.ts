import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET as health } from '../src/app/health/route';
import { GET as version } from '../src/app/api/version/route';

test('health endpoint returns only the public status', async () => {
  const response = health();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('version endpoint exposes release metadata and sanitizes revisions', async () => {
  const previousVersion = process.env.APP_VERSION;
  const previousCommit = process.env.APP_COMMIT;
  try {
    process.env.APP_VERSION = '0.3.0-beta.4';
    process.env.APP_COMMIT = 'abcdef1234567890';
    assert.deepEqual(await version().json(), {
      name: 'nfe-mock',
      version: '0.3.0-beta.4',
      commit: 'abcdef1',
    });
    process.env.APP_COMMIT = 'private-machine-name';
    assert.equal((await version().json()).commit, 'development');
  } finally {
    if (previousVersion === undefined) delete process.env.APP_VERSION;
    else process.env.APP_VERSION = previousVersion;
    if (previousCommit === undefined) delete process.env.APP_COMMIT;
    else process.env.APP_COMMIT = previousCommit;
  }
});
