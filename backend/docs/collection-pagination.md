# Collection pages and read-only federation exports

## Purpose and scope

`GET /conversations`, `GET /users`, and `GET /federation/export` now return
bounded DynamoDB scan pages with explicit continuation. Previously these
paths either stopped at one DynamoDB page or assembled an unbounded array.
This change requires the conversation ownership work in Agrinet #191. Its
private-chat rollout still requires the authenticated-stream companion #192.

Pagination must not make more private account data available. The directory
uses an allowlist, account records are omitted from federation exports, and
the export credential is separate from write-capable application credentials.
These are deliberate compatibility changes, not a claim that all existing
account or federation security gaps are closed.

## HTTP contract

`GET /users` and attachment downloads each have an independent limit of
1,000 requests per minute. A guard before account authentication uses the
account already verified by outer middleware, or an IP fallback. A separate
budget after account authentication enforces 1,000 requests per account even
when an API key accompanies the bearer token. Excess requests return HTTP 429
with `Retry-After`. Existing ownership, response fields and pagination remain
unchanged below the limit. Conversation and federation routes are unchanged.

Budgets are local to each server process and reset on restart. Multiple
instances need a shared limiter store for a deployment-wide budget. Proxy
trust settings are unchanged. The disposable storage-check HTTP server also
limits authentication attempts to 1,000 per minute per IP before verifying
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
alone is insufficient. Returned fields are `id`, `username`, and `role`, plus
the existing coarse `location` only when `locationPrivacy === true`. That
boolean is the existing sharing opt-in convention, not an inverted default.
Location filtering also requires that opt-in, preventing the filter itself
from revealing a private location. Missing/false privacy never publishes a
location. Coordinates, email, phone, password, verification code, scalar
reputation values, and unknown future fields are excluded. The database
projection and the response allowlist both enforce this boundary. Existing
role filtering remains available; role and location each accept one string.

This directory policy does not repair other account/admin/login endpoints,
role assignment, or the separate account-overwrite issue. Do not describe it
as full A3/A4/A5 implementation or as completed public signup hardening.

## Federation export is read-only inspection

Configure a strong, private `FEDERATION_EXPORT_KEY` on the exporting backend.
It must differ from `API_KEY` and `WIX_API_KEY`; equal or unset keys fail
closed. Supply it only in `x-federation-key` on `GET /federation/export`.
It grants no `/users`, admin, import or other write access. Ordinary account
JWTs and general API keys do not grant export access. Keep export keys on
servers, out of frontend builds, URLs and logs. There is no default key.

Export pages contain only explicitly selected advertised listing fields and
structural transaction fields. Existing participant/contract/listing IDs and
lifecycle flags are retained; `dialogNotes`, scalar ratings and all Users
records are excluded. `users` is always an empty compatibility array, not a
claim that the operator has zero members. `X-Federation-Omissions` states
`users, dialogNotes, ratings`. Advertised listing descriptions and locations
are still included; this is not an automatic PII scrubber for public content.
The duplicate legacy router delegates to the mounted router's same policy.

For outbound inspection, set `FEDERATION_PEER_KEYS` to a JSON object mapping
each approved peer's exact base URL (without trailing slash) to **that peer's
read-only export key**. For example, the structure is:

```json
{"https://peer.example":"<peer-provided-read-only-export-key>"}
```

Registry enrollment alone never causes a credential to be sent. Only
explicitly configured destinations are contacted; userinfo, query strings
and fragments in peer base URLs are rejected. HTTPS is required except for
loopback development. Redirects are refused, and continuation is a token,
never a destination URL. The local general API key is never forwarded.
Requests have a five-second timeout, a 16 MiB response limit and a 10,000-page
safety ceiling. Exceeding a limit is an explicit incomplete inspection, not
successful truncation. Older peers without `X-Pagination: cursor-v1`,
malformed pages and any peer page containing Users records are rejected.

The server-mounted worker and both legacy scheduled paths inspect all pages
and report counts. **Automatic import is disabled, and `lastSyncAt` is not
advanced.** The old importers overwrite canonical records without a source
namespace or auditable conflict policy; importing redacted summaries could
erase local narrative or account data. A16 cannot safely invent those rules.
Source-aware reconciliation remains A17 design work. No temporary unscoped
cache or new authority store is added. The legacy status router (not mounted by the default server) totals all pages
and reports `exportMode: read-only` and `usersExported: false`; its `lastSync`
value is historical data, not proof this inspection synchronized anything.

The original manual `/federation/import` endpoint and helper remain separate
legacy security debt; this PR does not certify them safe. General API/admin
authorization, collision policy, witnessed checkpoints and independent peers
remain open work. Operators must review existing import access before rollout.

These exports are interim application views, not commons artifacts, portable
reputation, signed exchange receipts, witnessed federation, or a coordination
wire extension. No ledger entry is edited, deleted or promoted to authority.
Escrow, credit configuration and the existing in-review conformance claims
remain outside the change.

## Rollout and verification

Review #191 first, then the A16 commit; deploy private chat with #192. No table
schema migration or new index is required. The application retains existing
Scan permissions. Configure distinct export and per-peer read credentials
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
