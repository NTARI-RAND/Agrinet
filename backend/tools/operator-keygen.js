#!/usr/bin/env node
/**
 * Operator key-set generator (Phase 5 onboarding).
 *
 *   node tools/operator-keygen.js > operator-keys.json
 *
 * Register the `keys` array with Agrinet (POST /operators { name, keys }) and keep
 * `private_keys` secret on the operator's server — they are never sent to Agrinet.
 * Sign transmissions with lib/operatorKeys.signTransmission using these private keys.
 */
const { generateKeySet, ALGO } = require('../lib/operatorKeys');

const set = generateKeySet();
process.stdout.write(JSON.stringify({
  algo: ALGO,
  keys: set.map((k) => ({ key_index: k.index, public_key: k.publicKey, algo: ALGO })),
  private_keys: set.map((k) => ({ key_index: k.index, private_key: k.privateKey })),
}, null, 2) + '\n');
