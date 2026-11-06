# Legacy account verification reachability audit

Reviewed on 2026-11-06 against upstream `main` at
`9373310afff24ca3294367e6308702446876bc2a`.

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
- The public NTARI Slack search found no `verifyUser` support declaration.
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

## Boundary with pending account work

The following PRs were still open when inspected:

- [#199](https://github.com/NTARI-RAND/Agrinet/pull/199), head
  `af02744744e782259ec0db9e146cad81035bd7d3`, owns email claims, conditional
  registration, direct login lookup and paginated backfill. Its proposed
  trim/lowercase lookup and duplicate-account operator decisions are not adopted
  by this audit. It does not change the legacy controller.
- [#197](https://github.com/NTARI-RAND/Agrinet/pull/197), head
  `3f8c1285d00edbaf482992d409882c516ebc921c`, owns account authorization and
  privileged user provisioning, including overlapping auth/user routes.
- [#194](https://github.com/NTARI-RAND/Agrinet/pull/194), head
  `05b894f082f03a7e9cf2a6ee3012093999415155`, overlaps user-route pagination
  and account response handling.

Do not duplicate those PRs, introduce a `UserEmails` table here, mount a new
verification route, or silently choose a duplicate-account migration policy.
If legacy support is established later, reconcile these account contracts first.

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
