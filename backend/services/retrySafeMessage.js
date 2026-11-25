const { createHash, scrypt } = require('crypto');
const { promisify } = require('util');
const deriveKey = promisify(scrypt);
const MessageSend = require('../models/messageSend');
const Message = require('../models/message');

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function problem(status, code, error) { return { status, body: { code, error } }; }
const failed = () => problem(500, 'message_send_failed',
  'This send failed and will not be repeated automatically. Inspect the conversation before starting a new send.');

async function send(req, deliver) {
  const key = req.headers['idempotency-key'];
  if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) {
    return problem(400, 'invalid_idempotency_key', 'Idempotency-Key must be 1–128 printable ASCII characters without spaces.');
  }
  // Auth middleware has already verified the JWT or accepted the configured
  // API key. Never use body.from (a display/role label) as the caller identity.
  const userId = typeof req.user?.userId === 'string' && req.user.userId ? req.user.userId : null;
  const apiKey = req.user ? null : req.headers['x-api-key'];
  if (!userId && !apiKey) return problem(400, 'idempotency_identity_required', 'Retry-safe sends require a stable authenticated user ID or API key.');

  const conversationId = req.params.conversationId;
  const { from, to, content, type = 'text', file } = req.body;
  const fingerprint = hash(canonical({ from, to, content, type,
    file: file?.data ? { name: file.name, type: file.type, data: file.data } : undefined }));

  let id, claim;
  try {
    // Credentials must not become cheap offline guessing targets in receipts.
    // The public scope supplies a deterministic salt so workers and restarts
    // find the same receipt. Keep JWT IDs and non-secret fingerprints unchanged.
    id = userId
      ? hash(['message-send-v1', ['user', userId], conversationId, key])
      : (await deriveKey(apiKey, hash(['message-send-api-key-v2', conversationId, key]), 32,
        { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 })).toString('hex');
    claim = await MessageSend.begin(id, fingerprint);
  } catch {
    return problem(503, 'message_send_unavailable', 'Retry protection is unavailable. No send was started by this request. Retry with the same key.');
  }
  if (!claim.claimed) {
    const { receipt } = claim;
    if (receipt.fingerprint !== fingerprint) {
      return problem(409, 'idempotency_key_conflict', 'This key was already used with a different message payload.');
    }
    if (receipt.state !== 'complete') {
      return problem(409, 'message_send_pending', 'This send is still running or was interrupted. Retry this key later; inspect the conversation before starting a new send.');
    }
    if (receipt.outcome.status === 500) return failed();
    const message = await Message.getMessage(conversationId, receipt.outcome.messageId);
    const reply = receipt.outcome.replyId ? await Message.getMessage(conversationId, receipt.outcome.replyId) : null;
    if (!message || (receipt.outcome.replyId && !reply)) {
      return problem(410, 'message_send_removed', 'The original message or reply is no longer available. It will not be recreated.');
    }
    return { status: 201, body: reply ? { message, ai: reply, reply } : { message } };
  }

  let result, outcome;
  try {
    const body = await deliver();
    result = { status: 201, body };
    outcome = { status: 201, messageId: body.message.id,
      ...(body.reply && { replyId: body.reply.id }) };
  } catch {
    // A failure may come after the message, an upload, a broadcast, or an
    // external AI call. Never assume those effects can be rolled back.
    result = failed();
    outcome = { status: 500 };
  }
  try { await MessageSend.complete(id, fingerprint, outcome); } catch {
    return problem(503, 'message_send_uncertain',
      'The send outcome could not be recorded. Retry only with this key; inspect the conversation before starting a new send.');
  }
  return result;
}

module.exports = { send };
