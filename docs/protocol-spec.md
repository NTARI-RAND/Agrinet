# Agrinet Protocol Specification

**Network Theory Applied Research Institute**
Document ID: P3-012 · Version: 0.1 (Draft) · June 2026
*Normative companion to P3-011 v2 (Janus Facing Applications), P3-002 (Agrinet Whitepaper), and the LBTAS specification.*

---

## 0. Status and scope

This document is the **normative specification** of the Agrinet protocol — the wire
format, the message ordering, the dialog/record lifecycle, and the guarantees the
protocol exists to protect. Where the whitepapers *argue* (the why), this document
*defines* (the what). It is the artifact a clean-room reimplementation (P3-011 §4)
builds against, and it is the irreducible constitution of P3-011 §3.3: the one layer
no participant can cheaply leave, because forking it incompatibly splits the
liquidity. It is therefore deliberately **minimal** and held under **standing
contestation** (§11).

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are
used as in RFC 2119.

An **implementation status** appendix (§12) maps each section to the current Agrinet
codebase and names the deltas that remain to reach conformance. The specification
describes the target; the appendix is honest about where the code has not yet caught
up.

---

## 1. Actors and identity

- **User** — a participant who transacts. Identity at the protocol layer is
  **pseudonymous**: a user is referenced by an opaque `user_id`. Personally
  identifying information MUST NOT appear in protocol records (see §9).
- **Operator** — a front end / federation instance that speaks the protocol on behalf
  of its users (e.g. Fruitful). The operator, not the browser, is the protocol
  endpoint. Operators authenticate per §2.
- **Adjudicator** — an operator-local role that can dismiss a rating (§6.4). An
  adjudicator is local to the front end that hosts the parties; it is never a global
  authority over the commons.

Submitting and reviewing are **distinct capabilities** and MUST be authorized
separately. Reads of raw records fail closed.

---

## 2. Operator authentication (rotating-key transmission auth)

Every protocol transmission (§3) is authenticated to a registered operator using the
rotating-key scheme of Phase 5.

- An operator registers a **set of `KEY_SET_SIZE` (= 7) public keys** with the
  protocol. Private keys are held only by the operator and MUST NOT be transmitted.
- Each transmission is signed by **`KEYS_PER_TX` (= 2) distinct keys** from the set.
- Signatures are **Ed25519** in this version. The scheme is **algorithm-agile**: a
  post-quantum signature (e.g. ML-DSA) MAY replace Ed25519 by changing only the
  `algo` field and the sign/verify primitive. The token shape, rotation, and replay
  handling are unchanged. Implementations MUST NOT hand-roll non-standard primitives.
- Transport confidentiality is provided beneath this layer (hybrid-PQ TLS via the
  edge); this specification covers authentication and record integrity, not transport.

A verifier MUST reject a transmission whose timestamp falls outside the freshness
window (= 5 minutes) or whose `nonce` has been seen within that window (replay).

---

## 3. The transmission

A **transmission** is the atomic, signed message of the protocol. It is the unit that
appends to a dialog file (§4).

### 3.1 Canonical form

A transmission is a header followed by a body and the operator signatures. **The
header MUST come first and MUST appear in the order below.** A receiver reads and
validates the header before trusting or routing the body; a transmission whose
fields are out of this order, or that omits a header field, is **out of protocol**
(§8) and MUST be rejected.

```
header (signed, ordered):
  v            protocol version (integer)
  operator_id  the registered operator
  dialog_id    the dialog this transmission belongs to (§4)
  seq          per-dialog sequence number, strictly increasing from 0
  type         transmission type (§3.2)
  actor_id     the user/adjudicator on whose behalf this is sent
  actor_role   the capacity of the actor in this dialog (e.g. buyer, seller,
               adjudicator, system) — see §6.2
  ts           millisecond timestamp
  nonce        unique per transmission (replay guard)
body:
  type-specific payload (§3.2)
auth:
  key_indices  the two key-set indices used
  sigs         the two signatures over canonical(header ‖ body)
```

The signed bytes are the canonical serialization of `header ‖ body`. Binding
`operator_id`, `dialog_id`, `seq`, `type`, `ts`, and `nonce` into the signature makes
each transmission specific to its position in its dialog: it cannot be reordered,
replayed, re-pointed to another key, or moved to another dialog without invalidating
the signature.

### 3.2 Ordering and sequence

- Within a dialog, `seq` MUST start at 0 and increase by exactly 1 per accepted
  transmission. A gap, a repeat, or a decrease is out of protocol.
- Certain types have **ordering preconditions** on the dialog state (§4.3). A
  transmission whose precondition is unmet is out of protocol (e.g. `escrow_settled`
  before the gating rating; `tranche_released` beyond `tranche_count − 1`).

This ordered, signed sequence is what makes execution **sequence-tampering** (skip,
reorder, inject, drop) detectable. It does **not** attest the honesty of the
computation *inside* a transmission — that residual is out of scope for this version
(§10).

### 3.3 Transmission types (initial registry)

| Type | Body (essential) | Precondition |
|---|---|---|
| `dialog_open` | participants, post anchor (§4.1) | seq 0 |
| `message` | text ref (operator-local), attachments ref | dialog open |
| `transaction_created` / `contract_created` | post/listing, amount, quantity, settlement | dialog open |
| `paid` | payment ref, escrow_locked | a created transaction |
| `ping` | progress note ref, media refs | a live contract |
| `tranche_released` | amount, index, of | live escrow; index ≤ count−1 |
| `rating` | rated_role, value (−1..+4) | counterparty defined |
| `audit_open` | target rating, reason ref | a `rating` of −1 |
| `audit_resolved` | outcome (upheld / dismissed) | an open audit |
| `escrow_settled` | beneficiary, amount | gating rating present; quiescent |
| `refunded` | amount | dispute resolution |
| `contract_transferred` | from, to, price | live escrow |
| `dialog_seal` | file hash, prev_hash (§4.4) | complete + quiescent |

The registry is extensible; new types are added by amendment (§11). Free-text
content (message bodies, rating narratives) is **never** carried in the protocol
body — only a reference. The text is operator-local (§9).

---

## 4. Dialogs and the record file

The protocol's unit of record is the **dialog**: one append-only file per exchange —
a transaction, a contract, or a negotiation — between users (and, where relevant,
adjudicators).

### 4.1 Opening

Every dialog is **anchored to a post** (of any type). A `dialog_open` transmission
(`seq` 0) names the participants and the post. There are no un-anchored dialogs:
messaging and transacting always occur in the context of a post.

### 4.2 Appending as received

As each transmission arrives and validates (§2, §3), it is **appended in order to the
open dialog file** on the operator's backend. The file accumulates the complete story
of the exchange: messages, transaction lifecycle, PINGs, ratings, audits. While open,
the file is append-only by protocol; its integrity in flight rests on the
per-transmission signatures (§2), not yet on a seal.

### 4.3 State and preconditions

A dialog is **open** until sealed. Key state tracked from the appended transmissions:
escrow status, `tranche_count` / released, each party's rating (present/absent),
and any open audit. Transmissions with unmet preconditions (§3.2) are rejected.

### 4.4 Sealing

A dialog seals when it is both **complete** and **quiescent**:

- **Complete** — every party owed a rating has one. A party that does not rate within
  its **rating window** is assigned a **system default rating of `+2`** ("Basic
  Satisfaction"): silence is read as a completed exchange with no complaint, not as
  praise and not as harm. A timeout default is emitted as a `rating` transmission with
  `actor_role = system` and is **marked as a timeout default**, so downstream can tell
  an affirmed rating from a defaulted one (it is distribution-distinguishable, like a
  dismissal). The default value is the single tunable constant here; `+2` is the
  conservative choice (it does not inflate reputation); `+3` is the documented
  alternative.
- **Quiescent** — there is **no open audit on either side**. A `−1` from *either*
  party (buyer→seller or seller→buyer) emits an `audit_open` and **holds the seal
  open** until a matching `audit_resolved` (upheld or dismissed) is appended. The seal
  therefore waits for adjudication to finish, in both directions.

Money finality and record finality are distinct. A ready-market purchase moves funds
quickly, but its dialog does **not** seal quickly: it stays open through the
producer's rating window (and any audit). Quick writes are quick in *settlement*, not
in *sealing*.

On seal, the final `dialog_seal` transmission:
1. computes the **hash of the complete file**,
2. records it with the previous sealed dialog's hash (`prev_hash`), and
3. anchors it on the Mycelium chain (§5).

After this point the sealed file is immutable.

### 4.5 Post-seal annotation

Adjudication that occurs **after** a seal (e.g. a late dismissal under §6.4) MUST NOT
edit the sealed file. It is recorded as a **new, separately anchored transmission that
references the sealed dialog by hash** — an annotation, never an erasure (consistent
with §6.3). The original record and its later annotation are both permanent and both
visible.

---

## 5. The Mycelium ledger

Mycelium is the **append-only, hash-chained** anchor of sealed dialogs. Each anchor
binds the sealed dialog's file hash to the previous anchor:

```
anchor.hash = H(prev_anchor.hash ‖ canonical(anchor))
```

Editing or removing any anchored record breaks the chain from that point forward, so
the record is tamper-evident as a whole. Anchors MUST be append-only; the protocol
never updates or deletes them. `verify` recomputes the chain and reports the first
break. The narrative text and any PII are **never** anchored (§9).

---

## 6. Reputation (LBTAS)

The peer layer is the Leveson-Based Trade Assessment Scale.

### 6.1 Distribution, never an average

A reputation is a **distribution**: the count of ratings at each level (`−1, 0, +1,
+2, +3, +4`) plus the total. Implementations MUST NOT compute or expose an average,
mean, or single-number score anywhere in a read or report. Volume sits beside harm;
it never cancels it.

### 6.2 Role-scoped

Reputation is kept **separately per role** — the capacity in which the rated party
acted (`market_seller`/`market_buyer`, `service_provider`/`service_client`,
`agrotourism_host`/`agrotourism_guest`, `plan_producer`/`plan_backer`,
`plan_fulfiller`/`plan_requester`, …), derived from the post type and the rated
party's side. A `−1` as an agrotourism guest MUST NOT touch a market-seller
reputation.

### 6.3 −1 carries a narrative; harm is never hidden

A `−1` ("No Trust") MUST carry a justifying narrative of ≤ 500 words. The rating
**event** is immutable and append-only. A dismissal (§6.4) **annotates** — it removes
the event from the *active* trust distribution but the event remains visible
downstream, annotated with who dismissed it and why. A front end MAY forgive harm; it
MUST NOT be able to hide it.

### 6.4 Contestable both ways

A harm claim MUST run **both ways**: a producer's `−1` of a consumer is as contestable
as the reverse. Any rated party MAY contest a rating made against them
(`audit_open`), in either direction. An adjudicator MAY dismiss a rating; a dismissal
is itself recorded (§4.5, §6.3). The system MUST NOT encode that one class is
trustworthy and the other is the risk.

### 6.5 Timeout defaults are marked

A rating produced by window timeout (§4.4) is system-attributed and marked as such; it
is distinguishable from an affirmed party rating in every read.

---

## 7. Settlement and the escrow gate

- Funds for a transaction are held in escrow by the protocol.
- The **consumer's rating is the release trigger.** A `0…+4` from the buyer releases
  the held funds to the producer. A `−1` does **not** release; it freezes the funds
  and opens an audit (§6.4, §4.4) for adjudication.
- A plan declares a **settlement model**: `on_confirmation` (release in full on the
  rating), `maturity` (release blocked until a snapshot delivery date), or `tranches`
  (escrow split into N progress payments; the buyer releases intermediate tranches as
  the producer reports; the final tranche is gated by the rating). In all models the
  protocol releases only the **still-held remainder**, and a dispute refund returns
  only the still-held remainder (released tranches stay with the producer).

---

## 8. Out-of-protocol handling

A transmission MUST be rejected (and not appended) if any of the following hold:

- header fields are missing or out of order (§3.1);
- `seq` is not the dialog's next expected value (§3.2);
- the signature(s) do not verify, fewer than two distinct keys are used, or a key is
  retired/unknown (§2);
- the timestamp is stale/future, or the nonce is a replay (§2);
- a type precondition on dialog state is unmet (§3.2, §4.3);
- the operator is revoked.

Rejection is the protocol's only response to malformation; the protocol does not
attempt to "repair" or reorder.

---

## 9. Entrenched portability guarantees (the minimal constitution)

The spec exists to protect a small set of guarantees and **almost nothing else** — so
that capturing the spec yields little, because power lives in the layers above it that
can be left (P3-011 §3.3). These guarantees are **entrenched**: changing them requires
the double supermajority of the NTARI bylaws (P3-011 §5).

1. **Immutable reputation events.** Rating events are append-only; dismissals annotate,
   never erase (§6.3).
2. **The market lives in the protocol.** Matching, liquidity, counterparties, and the
   reputation record are protocol-level, so leaving a front end costs only the front
   end — the user keeps the market and the record (P3-011 §3.2).
3. **Portable records.** A user's reputation and history are portable across front
   ends.
4. **PII never in the commons.** Free-text narratives and any personally identifying
   information are **operator-local**: held at the front end, referenced (not carried)
   by protocol transmissions, never anchored on the chain, never federated, and read
   only by a record's own parties and the operator's adjudicator.

Everything not on this list is mutable by ordinary amendment.

---

## 10. What this version does not guarantee

The ordered, signed, sealed record proves the **sequence and integrity** of an
exchange — no step is skipped, reordered, injected, or altered after sealing. It does
**not** attest the honesty of the **computation inside a single transmission**: an
operator running modified logic can still emit a well-formed, correctly-ordered,
correctly-signed transmission whose *contents* are the product of a rigged
computation (a skewed match, a manipulated price). Closing that gap requires
reproducible computation, zero-knowledge proofs, or trusted execution, and is a
research item, not a v0.1 guarantee. The checks that remain real against it are
legibility and cheap exit: a front end whose outputs are suspect can be left, and a
divergent reimplementation can be built from this spec and stay on the network.

---

## 11. Versioning and contestation

The protocol version is the `v` header field. The specification is the one layer no
one can cheaply leave, so it is the one place the contest must run permanently:

- Amendments to the entrenched guarantees (§9) require the double supermajority.
- All other amendments follow ordinary NTARI deliberation, which MUST preserve a
  **standing-opposition track**: a minority position persists and can be re-litigated
  without first proving harm. Deliberation MUST NOT average the outvoted-but-correct
  dissenter into a consensus (the same error as averaging a rating, at the level of
  governance).
- The **implementation** is forkable: any team MAY reimplement this wire format and
  remain on the network. The **specification** is what defines staying on the network;
  forking it incompatibly is secession, not voice.

---

## 12. Implementation status (informative)

This maps the spec to the current Agrinet codebase and names conformance deltas. It is
informative, not normative.

| Spec area | Status in code | Delta to conformance |
|---|---|---|
| §2 operator auth (7-key/2-sig, Ed25519, rotation, replay) | **Implemented** (`lib/operatorKeys`, `operatorRoutes`, `middleware/operatorAuth`) | Enforce on federation/operator routes; onboard operators (server-side signing) — deferred to the Cloudflare cutover. |
| §3 transmission header / per-transmission signing | **Partial** | Per-transmission signing of intra-dialog messages/events is not yet wired; today only operator-management calls carry the token. |
| §4 dialog file, append-as-received, seal | **Not yet** | Mycelium currently anchors **per-event** entries, not sealed **per-dialog files**. Refactor to: open dialog file → append transmissions → seal on complete+quiescent → anchor the file hash. |
| §4.4 timeout default (+2), seal-gating on audit | **Not yet** | Add the rating-window timeout sweep (emit a marked `+2` system rating) and block the seal while any audit is open. |
| §5 Mycelium hash chain | **Implemented** (`myceliumService`) at event granularity | Change the unit from event to sealed dialog (above). |
| §6 LBTAS distribution / role-scoped / both-ways contest / annotate-not-hide | **Implemented** (`services/lbtas`, `ratingRepository`, `ratingRoutes`) | — |
| §6.3/§9 narrative operator-local | **Implemented structurally** (`rating_narratives`, parties/adjudicator only) | Physical relocation to the front end's own store when Fruitful gains one; ensure federation never replicates narratives. |
| §7 escrow gate / maturity / tranches | **Implemented** (`transactionService`) | — |
| §9 market/reputation in the protocol, portable | **Implemented** (Agrinet backend holds posts/transactions/ratings/escrow/ledger; Fruitful is swappable UI) | Cross-node reputation federation (multi-backend) not built; single-protocol-many-frontends holds today. |
| §11 entrenchment / double supermajority | **Governance** (NTARI bylaws) | Out of code scope. |

---

*Network Theory Applied Research Institute, Inc. — 501(c)(3) — info@ntari.org*
*This specification is free documentation under the project's AGPL-3.0 commons; it is meant to be read, reimplemented, and contested.*
