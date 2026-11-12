# Legacy account verification reachability audit

Refreshed on 2026-11-11 against upstream `main` at
`e645b724109cc5c351676f6ac659737a3a64d82b`, including the merged security
hardening from #197. The original audit was performed on 2026-11-06.

## Legacy verification support boundary

No supported in-repository caller was found for either `registerUser` or
`verifyUser` in `backend/controllers/user_controller.js`. The server does not
mount this controller. There is therefore no demonstrated reachable verification
lookup defect to repair in the inspected application.

This is a reachability finding, not a claim that account verification works or
that all identity security requirements are satisfied. Leave the legacy module
in place; removing it could affect an undocumented external consumer. An external
consumer or an explicit maintainer decision to support these helpers would require
a new review and an agreed account-lookup/migration contract.

## Evidence

- `backend/server.js` mounts `backend/routes/authRoutes.js` at `/api/auth` and
  `backend/routes/userRoutes.js` at `/users` in non-minimal mode.
- The auth router defines `GET /test`, `POST /register` and `POST /login`.
  Registration and login are inline handlers, independent of the legacy module.
- The user router defines `GET /` and `POST /`, also using inline handlers.
- A search of tracked source, configuration and scripts found no reference to
  the legacy module name or either exported function outside its definition file.
  This includes the frontend and backend tests, not only HTTP routes.
- A runtime inspection loaded the actual non-minimal server, confirmed both
  account routers were mounted, enumerated the methods above and confirmed the
  legacy module was absent from Node's module cache. Unrelated BullMQ queue and
  worker constructors were replaced for this inspection to avoid Redis access;
  startup interval handles were cleared before their callbacks ran. Account
  routers and their handlers were not replaced, and no account writes were sent.
- The public NTARI Slack search during the original 2026-11-06 audit found no
  `verifyUser` support declaration. This historical search was not repeated
  during the refresh.
  The historical Agrinet channel ID was inaccessible; search absence is not
  proof that no external caller or private support agreement exists.

To reproduce the source check from the repository root:

```sh
rg -n 'user_controller|registerUser|verifyUser' backend frontend scripts
rg -n 'authRoutes|userRoutes' backend/server.js
rg -n 'router\.(get|post|put|patch|delete)' backend/routes/authRoutes.js backend/routes/userRoutes.js
```

The first command should find only the two declarations in the legacy controller.
The other commands show the mounted routers and their methods. Inspect dynamic
loading or new entrypoints separately if those mechanisms change.

The registration response currently says “Please verify your email/phone.”
That text is not evidence of a working verification endpoint, code-delivery
service or supported caller. This audit does not add such a workflow or change
that existing response contract.

## Boundary with merged and pending account work

As inspected on 2026-11-11:

- [#197](https://github.com/NTARI-RAND/Agrinet/pull/197) has merged into `main`.
  Its account authorization and privileged user provisioning are included in
  this audit baseline. Registration normalizes email, generates the account ID
  server-side and conditionally creates the account. User provisioning requires
  an administrator. These inline handlers still do not load the legacy controller.
- [#199](https://github.com/NTARI-RAND/Agrinet/pull/199), head
  `af02744744e782259ec0db9e146cad81035bd7d3`, remains open. It proposes email
  claims, direct login lookup and paginated backfill. Its lookup and
  duplicate-account migration decisions are not adopted by this audit. It does
  not change the legacy controller. The current `main` login still scans one
  DynamoDB page; this reachability finding does not resolve that separate issue.
- [#194](https://github.com/NTARI-RAND/Agrinet/pull/194), head
  `a7cc23468a3513bca5754222b8e5a0d5d5495f1d`, remains open and overlaps
  user-route pagination and account response handling.

Do not duplicate those PRs, introduce a `UserEmails` table here, mount a new
verification route, or silently choose a duplicate-account migration policy.
If legacy support is established later, reconcile these account contracts first.

## Refresh verification

The non-minimal runtime inspection confirmed the router methods listed above,
with no legacy controller in the module cache and no account writes sent.
The backend `npm test` command passed all 60 Node tests and 65 Jest tests.
`./scripts/list-hardcoded-urls.sh` and `git diff --check` also passed. The final
change relative to the inspected `main` is limited to this audit and its README
link; no verification endpoint, lookup implementation or migration was added.

## Contribution and acceptance boundary

This review establishes reachability before proposing a lookup change. No
supported caller was found, so no legacy lookup change is proposed.
Lookup-beyond-first-page, uniqueness and ambiguous-account behavior checks
apply only if a supported legacy path is retained; they are not claimed passing
or implemented by this disposition.

The [NTARI Bug-Build-Test culture](https://ntari.slack.com/docs/T0978JCFFSL/F0C9PQT2WTW)
requires contributions through a fork and PR, with a DCO sign-off on every commit.
The repository's `CLAUDE.md` also requires human review and prohibits authors
from merging their own PRs. This audit changes no runtime behavior, identity
policy, record format, covenant rule or settlement mechanism. No governance or
conformance binding is amended. Slack task adoption and completion are separate
workflow actions; this document does not claim that any Slack task was updated.
