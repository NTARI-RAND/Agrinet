# Agrinet (Brazil fork) — Conformance self-description

*Registry IDs: `JFA/jfa-conformance-suite.py`. Agrinet is the built instance here; several rows below are implemented and testable today — the next step is tests that cite these IDs so they stop being self-attested. `docs/mycelium-spec.md` carries the authoritative implementation-status table for the record layer.*

**Shape:** phase-one mutual-credit bootstrap (Part III, "Switching credit on"): fiat escrow marketplace with the witnessed-ledger discipline running underneath, building visible integrity.

| ID | Invariant | Status |
|---|---|---|
| REC-1 | Append-only | **Implemented** — dialog transmissions, immutable units (mycelium-spec) |
| REC-4 | Dialog seals complete-and-quiescent | **Implemented** — `sealIfComplete`: ratings given, no open dispute; −1 holds the seal |
| REC-10 | Marked default on rating-window expiry | **Implemented** — system `+2` timeout default, distribution-distinguishable |
| REC-3 | No PII anchored/federated | **Implemented** — refs only in `data`; narratives operator-local (relocation open, OQ-3) |
| REC-5 | Per-operator log | **Implemented** — federation sync of listings/blocks, no global chain |
| Witnessing (REC-6/7, problem 2) | Independent witnesses | **Stand-in, labeled** — single-witness; conduct evidence self-attested (OQ-2) |
| COV-1 | No averaging | **Implemented via LBTAS** — distribution read; fraud score must stay operational, never reputational (OQ-6) |
| ECO-1 | Balances from the sealed record | **Partial** — wallet ledger with audit; derivation-from-dialogs to verify at test time |
| ECO-4/5 | Escrow now; governed switch; earned-never-bought | **Met** — Stripe escrow phase one; switch ungoverned-in-code but unscheduled (OQ-4) |
| SUB-1 | No hosting chokepoint | **Partial** — fully self-hostable compose stack; single-VPS production is a labeled interim (OQ-5) |
| GOV-9 | Living open-questions document | **Met** — `OPEN-QUESTIONS.md` now ships here |
| GOV-10 | Copyleft commons | **Met** — AGPL-3.0; fork provenance recorded (OQ-1) |

**Honesty line:** the record core runs, but with one witness — every conduct claim is self-attested until federation is real (architecture problem 2). "Implemented" rows become "bound" only when tests citing these IDs land in CI.
