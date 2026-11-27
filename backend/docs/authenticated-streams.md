# Authenticated conversation streams

Conversation ownership (#191) and security hardening (#197) are merged into
this branch. Deploy their protections with this authenticated stream wiring.
The existing backend account JWT must be supplied as
`Authorization: Bearer <token>`; its verified `userId` must own the requested
conversation. Tokens must have a finite future expiry, as backend login tokens
already do. API keys and credentials in query strings grant no stream access.

`GET /stream/:conversationId` authorizes before sending SSE headers or
subscribing to live events. Foreign, missing and ownerless conversations have
the same 404 response. Successful streams preserve the existing `token` and
`message` payloads, disable caching, and request that reverse proxies disable
buffering. Authorization errors are JSON responses, never open SSE connections.

The unrestricted `GET /events` feed is retired: all requests receive 410
without account authentication. No current chat
component uses it. Generic transaction broadcast producers remain callable,
but their events are no longer exposed to arbitrary subscribers. Reintroducing
transaction events needs a specific recipient-authorization contract; this PR
does not infer one from a shared key or broad account membership.

Streams stop on socket closure/error and token expiry. The emitter rechecks
expiry before each write so delayed timers do not send post-expiry frames.
Parent conversation deletion revokes ready and pending connections on the
serving process immediately after the conditional database delete. Message
cleanup finishes first, preserving the parent and its owner if cleanup fails
so the operation can be retried. Pending registration precedes its strongly
consistent owner lookup; a concurrent delete therefore cannot be missed by
a late ownership-read response. This is a process-local stream registry, not
a distributed invalidation system: another replica's deletion or manual store
changes are not pushed to existing sockets here. Tokens remain the existing
signed bearer capability until expiry; no server-wide JWT revocation system
is introduced.

## Resource limits

Stream opening uses the existing chat-route pattern: 300 pre-authentication
attempts per minute per IP, then 60 per minute per verified account before the
ownership lookup. Open streams are separately capped at five per
account across all conversations, including pending ownership reads. Renewing a
token for the same account does not reset either budget. Excess attempts return
429. Idempotent cleanup releases capacity on disconnect, errors, expiry,
ownership failure, and deletion (including pending connections). The route uses
`createConcurrentStreamLimit({ maximum: 5 })` after authentication and the
account request limiter; it no longer keeps a second process-local count.

Set `REDIS_URL` and `RATE_LIMIT_REDIS_REQUIRED=true` for multiple replicas.
Request counters and stream reservations then share the existing Redis store;
without Redis, the fallback is suitable only for a single server process.
Capacity-store failures return 503 before stream opening. A disconnect during
acquisition releases its late reservation without opening the stream.

The existing helper expires abandoned reservations using their JWT expiry and
an eight-day Redis key TTL; it does not implement short renewable leases.
Failed release or process loss can retain slots until expiration. Redis reset
or key expiry can discard reservations, so this is not durable admission state.
Shared capacity does not add cross-replica event delivery or deletion revocation.
Keep `CORS_ALLOWED_ORIGINS` set to the exact deployed chat origin(s), as required
by the security deployment guide; this change selects no new deployment origin.

## Browser transport

Native EventSource cannot attach Authorization headers. The chat adapter now
uses streaming fetch and keeps the subset ChatWindow uses: add/remove event
listeners and `close()`. It parses UTF-8 SSE token/message frames across chunk
and CRLF boundaries. It retries transient network disconnects after one second,
with fresh account authorization, and stops on failed HTTP authorization or an
invalid content type. There is no replay guarantee or Last-Event-ID contract.
Buffering has a defensive 1 MiB text limit; oversized responses are cancelled
and stop permanently rather than entering a reconnect loop.

Call #191's `setAccountToken(token)` after the host application's existing login,
and `setAccountToken(null)` on logout. Every account change closes existing
streams immediately and remounts private chat state. Old frames are not
dispatched after closure. A 401 for the active account clears the token and
returns the sidebar and chat window to their sign-in state. A response from a
closed stream cannot clear a newly signed-in account. Credentials stay in
headers and memory, never URLs, browser storage or build-time account-token
configuration. A shared `VITE_API_KEY` alone is insufficient. Full browser onboarding remains outside
these two changes; the integration limits in `conversation-ownership.md` apply.

## Verification

`cd backend && npm test` exercises the production server using real HTTP
connections, verified account JWTs and isolated persistence/queue fixtures.
Coverage includes anonymous/shared-key/query-key/invalid-token denial, foreign
and legacy IDs, owner-only payloads, token expiry, retry after failed child
cleanup, and deletion racing a pending ownership lookup.

From `backend`, run the cross-process integration against disposable loopback
Redis with `STREAM_LIMIT_REDIS_URL=redis://127.0.0.1:PORT node --test __tests__/streamSharedCapacity.test.js`.
It opens five streams across two real server processes, rejects the sixth
despite renewed tokens and different conversations, isolates another account,
and verifies that disconnect releases a slot on the other server. Without the
explicit service URL this optional test skips; the default hosted backend
workflow does not provision Redis or establish this integration result.

`cd frontend/chat-ui && npm test` checks header credentials, fragmented SSE
frames, cancellation, account changes and terminal authorization errors.
`npm run build` verifies the browser bundle. These are private application
events; no Mycelium, covenant, escrow, protocol-wire or federation semantics
are changed, and the existing conformance stand-ins remain labeled.
