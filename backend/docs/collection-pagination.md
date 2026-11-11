# Collection pages and read-only federation exports

## Purpose and scope

`GET /conversations`, `GET /users`, and `GET /federation/export` now return
bounded DynamoDB scan pages with explicit continuation. Previously these
paths either stopped at one DynamoDB page or assembled an unbounded array.
This change requires the conversation ownership work in Agrinet #191. Its
private-chat rollout still requires the authenticated-stream companion #192.

Pagination must not make more private account data available. The directory
uses an allowlist, account records are omitted from federation exports, and
federation uses independently authenticated per-peer HMAC credentials.
These are deliberate compatibility changes, not a claim that all existing
account or federation security gaps are closed.

## HTTP contract

`GET /users` and attachment downloads each have an independent limit of
120 requests per minute. A guard before account authentication uses the
account already verified by outer middleware, or an IP fallback. A separate
budget after account authentication enforces 120 requests per account even
when an API key accompanies the bearer token. Excess requests return HTTP 429
with `Retry-After`. Existing ownership, response fields and pagination remain
unchanged below the limit. Message reads and sends (`GET` and `POST`
`/messages/:conversationId`) use the same two-guard policy with a separate
120-request budget shared across methods and conversation IDs for each
account. The guards run before ownership lookups, message storage and AI
responses. Adding an API key or refreshing a token does not reset an account's
budget. Conversation routes also retain the authentication-attempt and account limits from the security hardening change. Federation retains its separate peer limits.

The additional collection guards are process-local and reset on restart. The outer API and federation guards retain the existing Redis-backed store when configured. Configure Redis as described in `security-hardening.md` for multi-instance deployment; the collection guards do not replace that shared protection. Proxy trust settings are unchanged. The disposable storage-check HTTP server also
limits authentication attempts to 120 per minute per IP before verifying
credentials, and its acceptance check verifies exhaustion of that budget.

JSON response shapes remain arrays for conversations/users and
`{listings: [], transactions: [], users: []}` for federation export.
Pagination metadata is carried in response headers:

- `X-Pagination: cursor-v1` declares the contract.
- `X-Page-Limit` is the maximum number of records **evaluated**, per table,
  in that request. `limit` defaults to 50 and accepts decimal integers 1–100.
  Federation export can evaluate that many listings and transactions each.
- `X-Next-Cursor` is present only when there is another scan position.
  Pass its exact opaque value as `cursor`, with the original filters and
  limit, to the **same endpoint**. An empty result can still have a cursor:
  DynamoDB applies filters after evaluating records. Stop only when the
  continuation header is absent.
- `Cache-Control: private, no-store` prevents shared caching.

The approved browser origin can read these headers through CORS. Existing
clients outside this repository must be updated to follow the header;
otherwise they see only the first bounded page. The bundled chat account
client follows array pages, including empty pages, preserves filters and
credentials, and rejects account changes or later-page errors instead of
returning a partial old-account list. It still accumulates the full list in
browser memory, as before; this PR bounds individual server responses and
does not introduce a lazy-loading sidebar.

Cursors encrypt and authenticate DynamoDB continuation keys using AES-GCM
with a key derived from the existing `JWT_SECRET`. They expire after one
hour and bind endpoint, limit, directory filters and account identity where
applicable. Raw scan keys can identify private rows even on empty pages, so
they are not base64-encoded plaintext. Changing `JWT_SECRET` invalidates
cursors. Missing secret configuration returns 503 before scanning; invalid,
expired, tampered or mismatched parameters return 400. A storage failure
returns 500 without a successful partial page or continuation header.

Scans do not provide a snapshot or stable sort. For unchanged tables, following
all continuations returns the matching records. Concurrent additions,
updates and deletions can change what is observed; the API does not promise
exactly-once snapshot enumeration or claim an ordering DynamoDB does not give.
Restart from the first page if a cursor expires.

## Private conversation and directory boundaries

Conversations retain #191's account-only authentication and owner filter on
every scan. Other owners' and legacy ownerless rows remain inaccessible.
The existing all-results model helper remains for programmatic compatibility;
the HTTP route uses its bounded page counterpart.

`GET /users` now requires a verified account token; a shared integration key
alone is insufficient. Returned fields are `id`, `username`, legacy `role`, and
`locationType` when present, plus
the existing coarse `location` only when `locationPrivacy === true`. That
boolean is the existing sharing opt-in convention, not an inverted default.
Location filtering also requires that opt-in, preventing the filter itself
from revealing a private location. Missing/false privacy never publishes a
location. Coordinates, email, phone, password, verification code, scalar
reputation values, and unknown future fields are excluded. The database
projection and the response allowlist both enforce this boundary. Existing
role filtering remains available; `role`, `location`, and `locationType` each
accept one string and are bound into continuation cursors. `locationType` retains
the structural discovery field/filter from the account hardening change. Scalar
`reputationScore` and `reputationWeight` remain excluded: the repository covenant
requires full distributions rather than a single ranking score. This directory
introduces no replacement reputation schema.

The merged account hardening remains intact: user provisioning is admin-only, account IDs are server-generated, writes refuse collisions, and login/admin responses use their existing sanitized DTOs. Pagination does not replace or broaden those authorization policies.

## Federation export is read-only inspection

Federation uses the existing per-peer HMAC contract from
`security-hardening.md`. Both export and manual import require a configured
peer identity, a fresh signed request and the existing peer request limits.
Ordinary account JWTs, browser API keys and the obsolete `x-federation-key`
header cannot authorize a federation request. The former export-key flow is
removed; `FEDERATION_EXPORT_KEY` and `FEDERATION_PEER_KEYS` are not used.

Each export page has a response signature checked against the expected peer
identity before its contents reach an inspection consumer. Encrypted export
cursors also bind the authenticated peer. Manual imports retain authenticated
source provenance, field sanitization and conditional no-overwrite writes.

Export pages contain only explicitly selected advertised listing fields and
structural transaction fields. Existing participant/contract/listing IDs and
lifecycle flags are retained; `dialogNotes`, scalar ratings and all Users
records are excluded. `users` is always an empty compatibility array, not a
claim that the operator has zero members. `X-Federation-Omissions` states
`users, dialogNotes, ratings`. Advertised listing descriptions and locations
are still included; this is not an automatic PII scrubber for public content.
The duplicate legacy router delegates to the mounted router's same policy.

For outbound inspection, keep the operator-managed `NodeRegistry` records,
including each peer's `nodeId` and `url` (or legacy `nodeUrl`). Set
`FEDERATION_LOCAL_NODE_ID` (or `NODE_ID`) and
`FEDERATION_OUTBOUND_PEERS_JSON`, mapping the remote node ID to a pairwise
secret of at least 32 characters. The peer's `FEDERATION_PEERS_JSON` maps the
local sender ID to that same secret. No credential is sent for an unconfigured
node ID. There is no default credential; neither browser API keys nor HMAC
secrets are forwarded in plaintext.

Peer URLs reject userinfo, query strings and fragments. HTTPS is required
except for loopback development. Redirects are refused; continuation is a token,
never a destination URL. Keep clocks synchronized for the existing five-minute
signature window.
Requests have a five-second timeout, a 16 MiB response limit and a 10,000-page
safety ceiling. Exceeding a limit is an explicit incomplete inspection, not
successful truncation. Older peers without `X-Pagination: cursor-v1`,
malformed pages and any peer page containing Users records are rejected.

The server-mounted worker and both legacy scheduled paths inspect all pages
and report counts. **Automatic import is disabled, and `lastSyncAt` is not
advanced.** The old importers overwrite canonical records without a source
namespace or auditable conflict policy; importing redacted summaries could
erase local narrative or account data. This pagination change does not define those reconciliation rules.
Source-aware reconciliation remains separate design work. No temporary unscoped
cache or new authority store is added. The legacy status router (not mounted by the default server) totals all pages
and reports `exportMode: read-only` and `usersExported: false`; its `lastSync`
value is historical data, not proof this inspection synchronized anything.

The manual `/federation/import` endpoint retains the merged security controls, but is not called by scheduled inspection. Source-aware reconciliation of listing and transaction records, witnessed checkpoints and independent peers remain separate work; authenticated imports do not establish those guarantees.

These exports are interim application views, not commons artifacts, portable
reputation, signed exchange receipts, witnessed federation, or a coordination
wire extension. No ledger entry is edited, deleted or promoted to authority.
Escrow, credit configuration and the existing in-review conformance claims
remain outside the change.

## Rollout and verification

Review #191 before this pagination change; deploy private chat with #192. No table
schema migration or new index is required. The application retains existing
Scan permissions. Configure per-peer HMAC credentials
before enabling inspection; unset configuration deliberately fails closed.
Update external clients to consume pagination headers before rollout, and
communicate that automated merging and account replication are disabled.

`cd backend && npm test` covers production-mounted HTTP boundaries, empty
filtered pages, owner and query binding, cursor tampering/expiry, export
credential isolation, partial failures and non-mutating scheduled inspection.
`cd frontend/chat-ui && npm test && npm run build` checks the account adapter
and production bundle.

With DynamoDB Local on a loopback endpoint, run
`DYNAMODB_ENDPOINT=http://127.0.0.1:18001 node scripts/check-collection-pagination.js`
from `backend`. It creates uniquely named disposable tables and removes them
afterward. Records exceed DynamoDB's 1 MiB scan boundary, so continuation,
privacy projections, filtering, the actual account adapter and read-only
export traversal are checked against real storage. The check confirms local
credentials and narrative remain unchanged. CI runs the same check with a
digest-pinned local database image; no live peer, payment or AI call is made.
