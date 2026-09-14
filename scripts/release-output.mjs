import { appendFileSync } from 'node:fs';

const version = process.argv[2];
const output = process.env.GITHUB_OUTPUT;

if (!output || !/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(version || '')) {
  throw new Error('A valid semantic-release version and GITHUB_OUTPUT are required');
}

appendFileSync(output, `release_created=true\nversion=${version}\n`);
