# Account collection pagination

## Purpose and scope

`GET /conversations` and `GET /users` return bounded DynamoDB scan pages with
explicit continuation. They build on the conversation ownership boundary
merged in Agrinet #191. Private-chat streaming rollout still requires the
authenticated-stream work.

## HTTP contract

`GET /users` uses the existing API limiter and a separate 120-request-per-minute
budget keyed to the verified account. An API key alongside the bearer token
does not reset the account budget. Limits use the shared Redis store when
configured. Chat routes retain their existing ownership and rate limits.

Both endpoints return JSON arrays.
Pagination metadata is carried in response headers:

- `X-Pagination: cursor-v1` declares the contract.
- `X-Page-Limit` is the maximum number of records **evaluated**, per table,
  in that request. `limit` defaults to 50 and accepts decimal integers 1–100.
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
hour and bind endpoint, limit, directory filters and account identity. Raw scan keys can identify private rows even on empty pages, so
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
projection and the response allowlist both enforce this boundary. The directory supports role filtering; `role`, `location`, and `locationType` each
accept one string and are bound into continuation cursors. `locationType` retains
the structural discovery field/filter from the account hardening change. Scalar
`reputationScore` and `reputationWeight` remain excluded: the repository covenant
requires full distributions rather than a single ranking score. This directory
introduces no replacement reputation schema.

The merged account hardening remains intact: user provisioning is admin-only, account IDs are server-generated, writes refuse collisions, and login/admin responses use their existing sanitized DTOs. Pagination does not replace or broaden those authorization policies.

## Federation scope

Scheduled imports, per-peer HMAC authentication and signed exports continue to
use the implementation merged in #197. Pagination of the peer export needs a
compatible exporter and importer rollout. The peer-admission conditions are
recorded in [Governance Registry entries 3 and 4](https://github.com/NTARI-RAND/governance-registry/blob/main/GOVERNANCE-REGISTRY.md#entry-3--agrinet-federation-sync-per-peer-authentication-scheduled-import-kept-on).

## Rollout and verification

Apply this change on top of #191. No table migration or new index is required.
External clients must consume pagination headers before rollout.

`cd backend && npm test` covers the production-mounted HTTP boundaries, empty
filtered pages, owner and query binding, cursor tampering and expiry, and
storage failures.
`cd frontend/chat-ui && npm test && npm run build` checks the account adapter
and production bundle.

With DynamoDB Local on a loopback endpoint, run
`DYNAMODB_ENDPOINT=http://127.0.0.1:18001 node scripts/check-collection-pagination.js`
from `backend`. It creates uniquely named disposable tables and removes them
afterward. Records exceed DynamoDB's 1 MiB scan boundary, so continuation,
privacy projections, filtering and the actual account adapter are checked
against real storage. The check confirms local credentials remain unchanged. CI runs the same check with a
digest-pinned local database image; no live peer, payment or AI call is made.
