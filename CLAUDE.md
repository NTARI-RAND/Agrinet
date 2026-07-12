# CLAUDE.md — Agrinet

## What this repo is

The **reference economy** of Janus-Facing Architecture's Economy & Education layer: agricultural coordination and exchange over a per-operator dialog ledger (Mycelium), the covenant's assessment scale (LBTAS), and escrow settlement. Read `CONFORMANCE.md` first — it is the role declaration and the invariant table, stated honestly as of `main`, and it must be updated in the same PR as any change that alters a binding.

## Non-negotiable invariants

Not negotiable by feature request.

**Record (Mycelium)**
- Append-only: no update, no delete, no edit-to-resolve-a-dispute. Corrections and dismissals are new, visible entries.
- The dialog is the atomic unit; it seals only complete-and-quiescent. A clock never force-seals over an open harm claim.
- No PII in the commons: the chain commits structure and references; narrative stays member-local and erasable.
- Per-operator logs; no global chain, no consensus layer. Witnessing is the non-equivocation model, and a single-witness deployment is labeled the stand-in it is.

**Covenant (LBTAS adoption)**
- Never average ratings; carry `{distribution, total}`. No single score, no average-ranked lists — those APIs were removed in LBTAS v2 and must not be reimplemented locally.
- The lowest rating is the breach itself; volume never absolves it.
- Every claim answerable, both directions; dismissals annotate.

**Economy**
- Balances are a deterministic function of the sealed record; every exchange nets to zero.
- Settlement is escrow. The escrow-to-credit switch is a governed configuration change requiring Board approval, membership notice, and a completed regulatory review — never a code default, never Claude's to flip.
- No redeemability, no purchasable credit, no cross-economy convertibility. Fiat escrow is walled from any member-issued unit.

**Identity**
- Single participant identity: one member, simultaneously contributor and consumer. Never split.

## Change discipline

1. Branch → PR → CI green → human review. The author never merges their own PR.
2. `CONFORMANCE.md` rides along with any binding change.
3. The working tree may carry in-flight refactors — never commit, stash, or clean work you did not author; branch from `origin/main` via worktree for independent changes.
4. Never force-push, rewrite published history, or move a published tag.

## Requests to refuse or flag

Stop, name the tension, and surface it: average ratings or add a score; edit/delete ledger entries; store dispute narrative on the chain; flip escrow to credit; make credits purchasable or redeemable; merge fiat and member-credit paths; drop provenance fields on federation import; silent last-write-wins without an audit trail.

## Tension protocol

If you notice yourself reframing an invariant so a feature becomes convenient, implementing a stand-in without labeling it, or routing around an open problem instead of noting it — stop. Name the tension, attach it to the invariant or open problem by name, and propose the minimal conformant move. Surface it; do not absorb it.
