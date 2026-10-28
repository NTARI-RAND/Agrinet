# Authenticated conversation streams

This change depends on conversation ownership (A1). Deploy both changes
together. The existing backend account JWT must be supplied as
`Authorization: Bearer <token>`; its verified `userId` must own the requested
conversation. Tokens must have a finite future expiry, as backend login tokens
already do. API keys and credentials in query strings grant no stream access.

`GET /stream/:conversationId` authorizes before sending SSE headers or
subscribing to live events. Foreign, missing and ownerless conversations have
the same 404 response. Successful streams preserve the existing `token` and
`message` payloads, disable caching, and request that reverse proxies disable
buffering. Authorization errors are JSON responses, never open SSE connections.

The unrestricted `GET /events` feed is retired: authenticated requests receive
410 and unauthenticated requests fail account authentication. No current chat
component uses it. Generic transaction broadcast producers remain callable,
but their events are no longer exposed to arbitrary subscribers. Reintroducing
transaction events needs a specific recipient-authorization contract; this PR
does not infer one from a shared key or broad account membership.

Streams stop on socket closure/error and token expiry. The emitter rechecks
expiry before each write so delayed timers do not send post-expiry frames.
Parent conversation deletion revokes ready and pending connections on the
serving process immediately after the conditional database delete, even if
later message cleanup fails. Pending registration precedes its strongly
consistent owner lookup; a concurrent delete therefore cannot be missed by
a late ownership-read response. This is a process-local stream registry, not
a distributed invalidation system: another replica's deletion or manual store
changes are not pushed to existing sockets here. Tokens remain the existing
signed bearer capability until expiry; no server-wide JWT revocation system
is introduced.

## Browser transport

Native EventSource cannot attach Authorization headers. The chat adapter now
uses streaming fetch and keeps the subset ChatWindow uses: add/remove event
listeners and `close()`. It parses UTF-8 SSE token/message frames across chunk
and CRLF boundaries. It retries transient network disconnects after one second,
with fresh account authorization, and stops on failed HTTP authorization or an
invalid content type. There is no replay guarantee or Last-Event-ID contract.
Buffering has a defensive 1 MiB text limit; oversized responses are cancelled.

Call A1's `setAccountToken(token)` after the host application's existing login,
and `setAccountToken(null)` on logout. Every account change closes existing
streams immediately and remounts private chat state. Old frames are not
dispatched after closure. Credentials stay in headers and memory, never URLs,
browser storage or build-time account-token configuration. A shared
`VITE_API_KEY` alone is insufficient. Full browser onboarding remains outside
these two changes; the integration limits in `conversation-ownership.md` apply.

## Verification

`cd backend && npm test` exercises the production server using real HTTP
connections, verified account JWTs and isolated persistence/queue fixtures.
Coverage includes anonymous/shared-key/query-key/invalid-token denial, foreign
and legacy IDs, owner-only payloads, token expiry, committed deletion with
failed child cleanup, and deletion racing a pending ownership lookup.

`cd frontend/chat-ui && npm test` checks header credentials, fragmented SSE
frames, cancellation, account changes and terminal authorization errors.
`npm run build` verifies the browser bundle. These are private application
events; no Mycelium, covenant, escrow, protocol-wire or federation semantics
are changed, and the existing conformance stand-ins remain labeled.
