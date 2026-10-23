const { spawnSync } = require('node:child_process');
const tests = require('./test-files');

let failed = false;
for (const args of [
  ['--test', ...tests.node],
  [require.resolve('jest/bin/jest'), '--config', 'jest.config.js', '--runInBand'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
