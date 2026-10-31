# Conformance — Janus-Facing Architecture

The repo's self-description in the architecture's own terms, stated **before** anything product-specific, per the architecture's ordering rule. Every conformance claim is bound to the mechanism and check that enforces it, or it is labeled a stand-in or in-review. Unbound prose is marketing.

The architecture is **Janus-Facing Architecture (JFA)** — NTARI's unified architecture document, free documentation under the project's AGPL-3.0 commons.

## Role declaration

Agrinet is an **economy** of the JFA **Economy & Education layer** — the reference economy instance: agricultural coordination and exchange, applying the four layers beneath (substrate, record, covenant, governance) to a specific socioeconomic activity. It carries its own per-operator record instance and adopts the covenant's assessment scale at the economic level.

| This repo's term | Architecture role |
|---|---|
| Mycelium | the **per-operator dialog ledger** — append-only, hash-chained, dialog-sealed |
| Operator | an **operator**: one platform instance keeping its own log |
| LBTAS adoption | the **covenant** at the economic level — distributions, never averages |
| Escrow settlement | the economy's **phase-one** posture: escrow now, credit later, by governance |

## Invariants and their bindings — as of `main`

Honesty first: **the JFA member-economy machinery is in review, not on `main`.** The per-operator log scoping, witness checkpoint stub, operator model, and net-zero exchange accounting live on open refactor branches; `main` today is the application without them. Each invariant below binds when its branch lands, and this table is updated in the same PR (the rides-along rule).

| Invariant (architecture) | Status | Committed mechanism |
|---|---|---|
| The ledger is **append-only**; corrections are new entries; a dismissal annotates, never erases | In review | Mycelium: hash-chained per-exchange logs; no update, no delete |
| The atomic unit is the **dialog**, sealed complete-and-quiescent | In review | Dialog seal held open by unresolved harm claims; non-raters assigned a marked default |
| **No PII in the commons** | In review | The chain commits the shape of an exchange; narrative is referenced, member-local, erasable |
| Each operator keeps its **own log**; no global chain | In review | Per-operator log scoping; witnessing (not consensus) as the non-equivocation model |
| Witnessing with independence; single-witness deployments are **labeled stand-ins** | In review (stand-in) | Witness checkpoint stub; federation is open problem 2 |
| Reputation carried as a **full distribution**, never averaged | In review | LBTAS v2 (the no-averaging release) is the adoption floor |
| Balances a **deterministic function of the sealed record**; exchanges net to zero | In review | Net-zero exchange accounting |
| Settlement is **escrow**; the credit switch is governance, never a code default | Standing posture | Escrow-first; any move to member-issued credit requires Board approval, membership notice, and a completed regulatory review |

## Stand-ins and open residuals

- **Single-witness stand-in.** Until independent witnesses countersign the operator's checkpoints, the record's non-equivocation is self-attested and labeled as such.
- **Credit is not switched on.** Escrow is the opposite of credit and is described plainly as such; the three-phase bootstrap (volume and displayed integrity first) governs when that changes.
- **Cross-operator federation** exists in interim form (registry-enrolled peers, acknowledged interim conflict handling); witnessed checkpoints are the named target for cross-operator non-equivocation.

## Dependency declaration

Adopts the covenant scale (LBTAS, v2 floor) and carries its own record instance. Independent of the compute substrate's coordinator — an economy depends on the layers beneath it, never on a sibling economy or a particular coordinator.

## Product-specific notes (last, per the ordering rule)

The reference economy. Its operator/federation model is the named reference for the substrate's frontend-as-operator design target.

### Operator-local location data

Location persistence uses the separate `Locations` table, never the commons record or generic Users federation payloads. `backend/controllers/locationController.js` requires a verified account JWT for owner writes/reloads and explicit boolean consent for discovery. Public discovery emits an allowlisted location DTO and encrypted pagination cursors. `backend/scripts/check-locations.js` binds these claims to real DynamoDB storage checks. See [deployment, privacy semantics and residual limits](docs/location-api.md). This does not promote any in-review ledger binding or fix legacy user/federation account-security gaps.

The application message API supports optional retry receipts, scoped to the
authenticated caller and conversation. These are private operational metadata,
not sealed dialog or commons entries; they store hashes and message references,
not narrative. This does not promote any in-review binding above. See
[`backend/docs/retry-safe-messages.md`](backend/docs/retry-safe-messages.md) for
the guard, deployment requirements, crash limits, and executable checks.

### Browser garden planner

The Next.js `/garden-planner` page is a member-local planning aid, not a ledger
or a new protocol implementation. It reuses the existing square-foot gardening
utility for spacing, adjacent-crop rules, and fixed maturity estimates. The UI
states the limits of those estimates.

Saving is explicit and browser-local; versioned JSON export/import provides a
portable editable copy without account or vendor services. The format contains
only version, planting date, and crop layout. It is not sent to the shared record
or federation. No settlement, covenant, reputation, identity, or governance
binding changes, and the in-review statuses above remain in review.

`frontend/tests/gardenPlanner.test.cjs` checks crop totals, leap-day harvest
dates, adjacent-crop conflicts, resize impact, portable round-tripping, invalid
imports, and storage errors. This is feature verification, not a claim that the
delegated JFA invariants are now enforced by this repository.
