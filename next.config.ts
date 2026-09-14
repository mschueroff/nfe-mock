import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'xmllint-wasm', 'pdfkit', '@brasil-fiscal/nfe'],
};
export default config;
