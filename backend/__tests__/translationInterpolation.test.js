const assert = require('node:assert/strict');
const { test } = require('node:test');
const { translateMessage } = require('../utils/translation');

test('renders replacement-string markers in a region label literally', () => {
  const output = translateMessage('low_market_activity', 'en', { region: 'North $& $$' });

  assert.equal(output, '🌱 Low market activity in North $& $$. Consider broadcasting market needs.');
});

test('substitutes repeated template tokens without expanding tokens inside a label', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const output = translateMessage('{label} and {label} in {region}', 'en', {
    label: 'Farm {region}',
    region: 'Oaxaca',
  });

  assert.equal(output, 'Farm {region} and Farm {region} in Oaxaca');
  assert.equal(warn.mock.callCount(), 0);
});

test('warns when a token in the original template has no supplied value', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const output = translateMessage('{label} in {region}', 'en', { label: 'Farm' });

  assert.equal(output, 'Farm in {region}');
  assert.deepEqual(warn.mock.calls.map((call) => call.arguments), [
    ['Unresolved placeholder in translation:', 'Farm in {region}'],
  ]);
});
