let jwt;
try {
  jwt = require('jsonwebtoken');
} catch {
  const crypto = require('crypto');
  const base64url = (input) => Buffer.from(JSON.stringify(input)).toString('base64url');
  jwt = {
    sign(payload, secret) {
      const header = { alg: 'HS256', typ: 'JWT' };
      const data = `${base64url(header)}.${base64url(payload)}`;
      const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
      return `${data}.${signature}`;
    },
    verify(token, secret) {
      const [headerB64, payloadB64, signature] = token.split('.');
      const data = `${headerB64}.${payloadB64}`;
      const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
      if (signature !== expected) throw new Error('invalid signature');
      return JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    }
  };
}
module.exports = jwt;
