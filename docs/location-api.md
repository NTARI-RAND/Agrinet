# Local location persistence and discovery

Locations are mutable application data, kept in a separate operator-local DynamoDB table. They are not ledger entries or federation payloads. `Users` is deliberately not the storage target: existing user/admin/federation endpoints return whole user records, and federation imports can replace them. Those existing account-security gaps remain separate work; this feature still trusts account JWTs issued by the backend.

## Deployment

Create a table named `Locations` (or set `LOCATION_TABLE_NAME`), with string partition key `id`, no sort key, and on-demand billing. Grant the backend `dynamodb:GetItem`, `dynamodb:PutItem`, and `dynamodb:Scan` on this table. For example, using the operator's configured AWS region:

```sh
aws dynamodb create-table --table-name Locations \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST
```

Use the normal AWS region/credentials configuration and a strong `JWT_SECRET`. Missing storage returns HTTP 500; it never reports a successful save. Do not add this table to federation exports. Restrict database access and backups as private member data.

Existing `Users.coordinates`, `locationType` and `locationPrivacy` are not copied or consulted. Members must explicitly save and opt in again. This avoids silently publishing legacy coordinates; it does not repair any pre-existing leakage of legacy user records.

## Save and reload

`POST /api/location/:id` and `GET /api/location/:id` require an unexpired HS256 backend bearer token whose `userId` exactly equals `:id`. An API key, role, body ID, or another account token cannot establish ownership, even when an API key passes the outer middleware. The existing server's authentication middleware still applies to discovery as well.

Example POST body:

```json
{"coordinates":"geoLat_17.18113,geoLong_48.11553","locationType":"farm","privacy":false}
```

`privacy` must be an explicit JSON boolean on every save. For compatibility with the original discovery code, **true means shared; false means private**. The label is historical and counterintuitive. Any future form must label this as “Share exact coordinates in discovery”, unchecked initially, and disclose the precision before opting in. No location form currently exists in this repository.

Coordinates use the existing AgriNet decimal-string format. Latitude is inclusive [-90, 90], longitude [-180, 180]. Shared coordinates retain the supplied numeric precision; no rounding or approximate-location claim is made. `locationType` is optional; when present it is `farm`, `production`, or `delivery`. Each save replaces the owner's complete location record; omitting the type removes the previous type. Unknown body properties are ignored. Saving with `privacy: false` withdraws it from subsequent discovery reads; it cannot recall copies already downloaded.

The save response includes `message`, `id`, `coordinates`, `privacy`, and optional `locationType`. Owner reload returns the same location fields without `message`; an unsaved location returns 404. Responses use `Cache-Control: no-store`. Invalid values return 400, missing/invalid account tokens 401, other owners 403, and storage failures 500.

Owner reads and writes share a limit of 1,000 requests per minute. A guard before owner authentication uses the account already verified by outer middleware, or an IP fallback. A separate budget after owner authentication enforces 1,000 requests per account even when an API key accompanies the bearer token. Excess requests return HTTP 429 with `Retry-After`. Ownership, privacy and response fields remain unchanged below the limit; discovery is unchanged.

Budgets are local to each server process and reset on restart. Multiple instances need a shared limiter store for a deployment-wide budget. Proxy trust settings are unchanged; arbitrary forwarded headers cannot select another budget.

## Bounded discovery

`GET /api/location?lat=17.18113&long=48.11553&radius=10&type=farm`

Radius is a finite, non-negative number in **kilometres**, including the boundary (`distance <= radius`). Zero selects exact matching coordinates. Latitude/longitude use the same bounds as saved coordinates. Numeric query parameters must be complete decimal values, not trailing text, arrays, blank strings, NaN or infinity. `type` is optional and uses the same three values.

The body remains a JSON array. Each entry contains only `id`, `coordinates`, and optional `locationType`. Only rows explicitly saved with `privacy: true` are eligible. No contact, password, verification, role, reputation or other user attributes are returned.

Each request evaluates at most 100 table records (and DynamoDB's 1 MiB page limit), then filters by sharing, type and distance. If response header `X-Next-Cursor` is present, repeat the same query with `cursor=<value>` until it is absent. An empty page can have a continuation. The header is exposed for browser clients. Cursors encrypt and authenticate the scan key, so a page ending on a private row does not reveal its account ID. They are bound to the parsed query, expire after one hour, and become invalid on `JWT_SECRET` rotation. Invalid/tampered/query-mismatched cursors return 400. Do not construct or interpret them.

This is bounded DynamoDB scan pagination, not a spatial index or snapshot. Concurrent changes can affect later pages. Strong reads reduce stale publication after withdrawal; there is no cross-request snapshot or recall guarantee. A spatial index is separate work if table size makes scans unsuitable.

## Verification

Run the normal backend suite with `npm test`. For real storage checks, start a disposable DynamoDB Local instance bound to loopback port 18001, then run from `backend`:

```sh
node --test scripts/check-locations.js
```

`DYNAMODB_ENDPOINT` may select another loopback endpoint. The check refuses remote hosts, supplies dummy credentials, creates a uniquely named table, and deletes it on completion. It verifies durable writes, owner reload/access denial, explicit publication/withdrawal, exact safe response fields, coordinate/radius validation, multiple pages, cursor tampering/query binding, and honest storage failures. CI runs this check against a digest-pinned DynamoDB Local image.

The disposable HTTP server also limits authentication attempts to 1,000 per minute per IP before verifying credentials. The check verifies budget exhaustion without bypassing authentication or throttling in test mode.
