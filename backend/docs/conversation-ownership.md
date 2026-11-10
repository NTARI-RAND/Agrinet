# Private conversation ownership

## Boundary

Private chat uses the existing backend login JWT's `userId`, verified as an
HS256 account token. A shared `API_KEY`/`WIX_API_KEY` identifies an integration,
not a participant, and grants no conversation, message or attachment access.
Supplying a valid integration key alongside a bearer never bypasses bearer
verification. No Cognito `sub`, caller-supplied owner, message sender label or
administrative role is treated as a substitute account identity.

New Conversations rows carry immutable `ownerId`. Listing filters on that
owner across DynamoDB scan pages. Detail reads, rename, pin, delete, message
reads and sends check ownership. Rename/pin/delete also carry a conditional
owner check in DynamoDB. Foreign, missing and ownerless IDs return the same
404. A denied send reaches neither file writes, messages, responders nor
broadcasts. Attachments require a message reference belonging to an owned
conversation; responses disable caching and download as inert attachments.

This is application-local private chat. It does not seal a JFA dialog or
modify Mycelium commitments, exchange records, reputation, escrow or federation.
The separate status of those mechanisms in CONFORMANCE.md remains accurate.

## Existing data and deployment

Back up Conversations and Messages before rollout. Legacy conversations were a
shared pool, not account-owned records. Existing rows without an
owner remain stored but inaccessible; the application never grants them to
the first caller or guesses an owner from `from`. An operator must establish
the rightful existing account through independent evidence before making an
explicit, conditional administrative backfill. This PR supplies no public
claim/transfer endpoint and performs no automatic data migration or deletion.
If ownership cannot be established, preserve the inaccessible row for the
operator's data-retention process. Ownership transfer is not supported here.

Conversation deletion follows every Messages query page and deletes in batches
of at most 25 writes. Messages are removed before the conversation row, so a
storage error or unprocessed batch leaves ownership available for a retry.
This does not erase physical attachment bytes or durable retry receipts. Stale
attachment files become inaccessible when their owned message/conversation
reference no longer exists.

The deployment needs DynamoDB GetItem/Scan/PutItem/UpdateItem/DeleteItem access
to the configured conversation table and the existing message access, now
including Query for conversation-scoped attachment lookup and Scan for legacy
`/uploads/:name` compatibility. New downloads use
`/conversations/:id/attachments/:name`, checking ownership before querying only
that conversation partition, including continuation pages. No new index or
table is required. New files use UUID names, safe extensions and exclusive
writes; original names remain in message metadata.

This branch includes the merged account/federation security baseline. Legacy
`/events` and `/stream/:conversationId` return 410; keep that protection until
#192 installs owner-authenticated streaming. #191 restores only authenticated,
rate-limited, owner-checked attachment access. It can merge while streams remain
disabled. Restore streaming only after reviewing #192 against this branch and
its shared concurrent-stream reservation helper.

Operators can count ownerless conversations without changing records:

```sh
aws dynamodb scan --table-name "$CONVERSATION_TABLE_NAME" --select COUNT \
  --filter-expression 'attribute_not_exists(ownerId)' --consistent-read
```

Use the deployment's table name and normal read credentials. Include every
page when counting through an SDK; a filtered page can be empty and still have
a continuation key. This count does not establish ownership or migrate data.

## Request limits

Authenticated conversation and message routers each allow 120 requests per
minute per account. Legacy uploads allow 60 requests per minute. Limits run
after account verification and before database work; a renewed token for the
same user does not reset the budget. IP subnet keys are the fallback when no
account identity is available. Rejected requests return 429 and Retry-After.
These budgets are configured at route registration through `chatRateLimit`.
With `REDIS_URL` configured, these counters share the existing Redis store across
server instances. Conversation, message and legacy-upload budgets use separate
namespaces. Set `RATE_LIMIT_REDIS_REQUIRED=true` for multi-instance deployment;
startup refuses a missing Redis URL, and store errors fail closed. Without Redis,
counters are local to one process. The existing general API budget also applies.
Each route names authentication and its account limiter explicitly before the
owner/database work. Authentication attempts retain the IP-based pre-auth limit.

Verify shared counters against disposable loopback Redis from `backend`:

```sh
CHAT_LIMIT_REDIS_URL=redis://127.0.0.1:6379 node --test __tests__/chatSharedRateLimit.test.js
```

The check starts two local server processes, alternates 120 requests using fresh
tokens for one account, and requires request 121 to return 429. Another account
keeps its budget. The normal unit suite skips this explicit integration check
when `CHAT_LIMIT_REDIS_URL` is absent.

## Browser integration

The chat UI previously sent only a shared build-time API key and has no
working account-login screen. The host application's account flow must obtain
the existing backend `/api/auth/login` response and pass its token to the
exported `setAccountToken(token)` in `frontend/chat-ui/src/api.js`. Call
`setAccountToken(null)` on logout. Tokens stay in memory; the adapter uses
Authorization headers, never query strings or browser storage. Account changes
clear chat state and discard in-flight responses from the old account. Setting
the same token again preserves state. Missing or rejected account credentials
show “Sign in to use chat”; a 401 clears the expired token. Trusted-origin
preflights permit Authorization, x-api-key and Idempotency-Key.

Do not substitute an Amplify/Cognito token without an approved backend identity
binding. The merged security baseline exposes `/api/auth/login` publicly behind
its own authentication-attempt throttle. The host account flow supplies the
returned backend JWT; this PR adds no separate login UI or token storage.

The same-origin host can import the adapter and call it after its existing login:

```js
import { setAccountToken } from './src/api.js';

// `loginResponse` is the successful /api/auth/login response.
setAccountToken(loginResponse.token);
// On host logout:
setAccountToken(null);
```

After installing both `backend` and `frontend/chat-ui` dependencies, run this
explicit integration check from `frontend/chat-ui`:

```sh
node --test hostAccount.integration.js
```

It obtains a JWT through the real backend login route with synthetic local
account storage, passes it through the exported setter, and reads an owned chat
through the real account-authenticated route. A rejected token clears the
adapter back to the UI's sign-in state. This verifies the integration contract;
operators must still wire their deployed host's login/logout events and set
`CORS_ALLOWED_ORIGINS` to its exact origin. The check runs no live account writes.

Attachment buttons download through the authenticated adapter rather than
opening uncredentialed URLs. Malformed, external and non-upload download paths
are rejected before forwarding credentials. Redirects are rejected.

## Verification

`cd backend && npm test` includes production-server HTTP tests for two users,
legacy records, missing IDs, conditional mutation ownership, malformed subjects,
shared-key bypass attempts and protected attachments. AI provider calls and
background queues are isolated; account verification, mounted routes and the
authorization/model logic remain real. `cd frontend/chat-ui && npm test`
checks credential placement, account changes, attachment destinations and the
existing chat reducer. Database-backed verification uses isolated DynamoDB
Local tables, never live records.

Run the storage check with `DYNAMODB_ENDPOINT=http://127.0.0.1:18001 node
scripts/check-conversation-ownership.js` from `backend`, after starting
DynamoDB Local on that loopback port. It creates uniquely named disposable
tables and removes them afterward. The check refuses non-loopback endpoints.

Scope follows the [Fruitful communications overview](https://ntari.atlassian.net/wiki/spaces/Fruitful/pages/44761089)
and [Slack's instruction to use Janus and bylaws](https://ntari.slack.com/archives/C0AENHR5KG8/p1791982812690669).
Current repository invariants take precedence over older architecture summaries.
