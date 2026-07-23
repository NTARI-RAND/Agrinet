# Agrinet (Brazil fork) — Open Questions

*The living open-questions deliverable required by Janus-Facing Architecture (standard check 7). Reviewed and re-shipped with each release; staleness is nonconformance. An entry leaves only by resolution or by an explicit values call made by the people who live with the outcome. Invariant IDs cite the registry in `JFA/jfa-conformance-suite.py`.*

Agrinet is the **built** instance in this folder: a phase-one escrow marketplace (fiat on-ramp, witnessed-ledger discipline underneath) with the dialog-ledger record implemented per `docs/mycelium-spec.md`.

## 1. Fork relationship with upstream
**Problem.** This tree is the Brazil adaptation (Carlos Zamboni) of NTARI-RAND/Agrinet. Divergence cadence, what flows upstream, and who reviews cross-flow are undefined.
**Constraints inherited.** Provenance is inbound = outbound under AGPL-3.0 (GOV-10): fork freedom is the point, and improvements can flow both ways without assignment to a center. The fork is exit working as designed — keep it legible by recording the relationship, not by restricting it.
**Status.** Open — define a sync/contribution cadence with upstream.

## 2. Witness federation (architecture problem 2, directly)
**Problem.** The record core is implemented (per-operator log, seal-on-complete-and-quiescent, marked timeout defaults, PII never anchored — see the status table in `docs/mycelium-spec.md`), but it runs single-witness: every conduct read is self-attested.
**Constraints inherited.** A single-witness deployment carries the stand-in label and cannot present itself as federated; an independent witness joins by appending a countersignature, no protocol change. Until two or more independent, long-lived witnesses exist, dispositions must name their evidence as self-attested.
**Status.** Open — inherits network problem 2; Agrinet is a natural first federation site.

## 3. Narrative store relocation (already named in mycelium-spec)
**Problem.** Rating narratives live in the backend's `rating_narratives` store; the spec's own note says relocate to the front end when one exists, and federation excludes it.
**Constraints inherited.** PII and free text never anchor and never federate (REC-3); the narrative belongs in the erasable, operator-local layer.
**Status.** Open — tracked here so it survives the spec's table.

## 4. The escrow-to-credit switch
**Problem.** Agrinet settles in fiat escrow via Stripe (phase one). Whether and when member-issued credit enters is undecided.
**Constraints inherited.** The switch is a governed configuration change, never a rebuild (ECO-5), gated by Board approval, membership notice, and a completed regulatory review (bylaws §5.7); credit would be earned, never bought, never redeemable (ECO-4); issuance covenant-gated and capped by a separate limit never derived from harms (ECO-2). Get the regulatory read before any phase-two move — the Brazilian read is its own work, distinct from any US read.
**Status.** Open; escrow phase holding, no switch scheduled.

## 5. Production hosting posture
**Problem.** Production runs on one VPS behind duckdns, with images on Docker Hub and media on Cloudflare R2 — single-operator, single-host.
**Constraints inherited.** No unremovable hosting chokepoint (SUB-1). The compose stack is fully self-hostable, so the *mechanical* exit exists; the single-VPS production is a labeled stand-in, not an end-state, and the R2/Docker Hub dependencies deserve exit notes (S3-compatible and registry-portable respectively).
**Status.** Open — acceptable interim, label it in ops docs.

## 6. Fraud scoring vs. the covenant
**Problem.** The antifraude layer computes a fraud score and trust levels — numeric composites adjacent to reputation.
**Constraints inherited.** A score may gate *operational* risk controls (velocity, moderation queue) but must never become the member's reputation: reputation stays the LBTAS distribution, never a number (COV-1); an automated flag is an input to the moderation queue, never an auto-finding (flag-never-finding — the queue already exists, keep the human in it).
**Status.** Open — audit the read paths so fraud score and reputation never merge in any display or gate.
