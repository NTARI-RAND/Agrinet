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

Back up Conversations and Messages before rollout. Existing rows without an
owner remain stored but inaccessible; the application never grants them to
the first caller or guesses an owner from `from`. An operator must establish
the rightful existing account through independent evidence before making an
explicit, conditional administrative backfill. This PR supplies no public
claim/transfer endpoint and performs no automatic data migration or deletion.
If ownership cannot be established, preserve the inaccessible row for the
operator's data-retention process. Ownership transfer is not supported here.

The existing Messages deletion helper still has its previously documented
large-history batching/retry limitations. This change establishes who may
invoke deletion; it does not claim complete erasure of large histories or
physical attachment bytes. Stale attachment files become inaccessible when
their owned message/conversation reference no longer exists.

The deployment needs DynamoDB GetItem/Scan/PutItem/UpdateItem/DeleteItem access
to the configured conversation table and the existing message access, now
including Scan for attachment-reference lookup. Scans require no new index
or table. They prioritize correct isolation; an indexed attachment lookup is
a possible measured follow-up, not supplied by this change.

**Roll out together with the authenticated-stream companion PR (A2).** A1
closes REST and attachment access; unauthenticated SSE remains a separate
existing path until A2 lands. Other open hardening work, including admin,
user/federation authorization and attachment write containment, remains
separate and must be assessed before exposing public signup.

## Browser integration

The chat UI previously sent only a shared build-time API key and has no
working account-login screen. The host application's account flow must obtain
the existing backend `/api/auth/login` response and pass its token to the
exported `setAccountToken(token)` in `frontend/chat-ui/src/api.js`. Call
`setAccountToken(null)` on logout. Tokens stay in memory; the adapter uses
Authorization headers, never query strings or browser storage. Account changes
clear chat state and discard in-flight responses from the old account.

Do not substitute an Amplify/Cognito token without an approved backend identity
binding. PR #183 separately makes backend login/registration publicly
reachable; until it lands, login still needs the server's existing integration
authentication. This PR does not claim completed browser onboarding.

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
