import packageJson from '../../package.json';

const cleanCommit = (value: string) =>
  /^[0-9a-f]{7,40}$/i.test(value) ? value.slice(0, 7) : 'development';

export function applicationVersion() {
  return {
    name: 'nfe-mock',
    version: process.env.APP_VERSION || packageJson.version,
    commit: cleanCommit(process.env.APP_COMMIT || ''),
  };
}
