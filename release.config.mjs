const stable = process.env.GITHUB_REF_NAME === 'main';

const execPlugin = [
  '@semantic-release/exec',
  stable
    ? {
        prepareCmd: 'npm version ${nextRelease.version} --no-git-tag-version --allow-same-version',
        successCmd: 'node scripts/release-output.mjs ${nextRelease.version}',
      }
    : { successCmd: 'node scripts/release-output.mjs ${nextRelease.version}' },
];

const config = {
  branches: ['main', { name: 'developer', channel: 'beta', prerelease: 'beta' }],
  tagFormat: 'v${version}',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'angular',
        releaseRules: [{ type: 'perf', release: 'patch' }],
      },
    ],
    ['@semantic-release/release-notes-generator', { preset: 'angular' }],
    execPlugin,
    ...(stable
      ? [
          '@semantic-release/changelog',
          [
            '@semantic-release/git',
            {
              assets: ['CHANGELOG.md', 'package.json', 'package-lock.json'],
              message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
            },
          ],
        ]
      : []),
    [
      '@semantic-release/github',
      {
        successComment: false,
        failComment: false,
      },
    ],
  ],
};

export default config;
