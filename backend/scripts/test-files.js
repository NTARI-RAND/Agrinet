const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');

const files = { node: [], jest: [] };
function discover(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'coverage') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) discover(file);
    else if (file.endsWith('.test.js')) {
      const runner = readFileSync(file, 'utf8').includes("require('node:test')") ? 'node' : 'jest';
      files[runner].push(file);
    }
  }
}
discover(path.resolve(__dirname, '..'));
module.exports = files;
