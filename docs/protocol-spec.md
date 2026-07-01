# Agrinet Protocol Specification

**Network Theory Applied Research Institute**
Document ID: P3-012 · Version: 0.3 (Draft) · June 2026
*Normative companion to P3-011 v2 (Janus Facing Applications), P3-002 (Agrinet Whitepaper), and the LBTAS specification. Held to* Janus-Facing Architecture *(builder's guide, v2.0) and* Building JFA Software *(operating brief, v1.0): Agrinet is an instance of that architecture, and this specification answers to its seven-point standard (§13).*

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

**Agrinet is an instance of Janus-Facing Architecture (JFA):** a member-issued mutual
credit network governed by the cost of leaving each layer, built floor-up — substrate,
then record, then covenant, then economy. Its settlement **today is escrow**, which is
the *opposite* of credit; this specification names it as the **stand-in it is** (§7).
The architecture is mutual-credit-ready, but credit is **not yet switched on**. The
specification therefore defines both the protocol as it runs and the invariants that
keep the escrow stand-in one policy switch away from credit, and it **ships its status
honestly** (§10, §12) rather than performing the absence of a gap.

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

**Substrate.** Sovereignty is built floor-up: a layer is sovereign only because the
one beneath it is. The protocol endpoint runs on a substrate its participants can
own — NTARI's instance is **SoHoLINK**, a federated marketplace over participant-owned
hardware. There MUST be no unremovable hosting chokepoint: Agrinet MUST be able to run
on infrastructure a community controls, even where it usually runs on a shared backend
today. A higher layer built on an unsovereign substrate is decoration.

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

## 5. The Mycelium ledger — a per-operator witnessed log

Mycelium is the record layer: an **append-only, hash-chained log of sealed dialogs**.
Its design philosophy is **detection, not prevention** — tampering is not made
impossible, it is made evident.

### 5.1 Per-operator, not one global chain

Each operator keeps **its own** append-only log. There MUST NOT be one global chain,
and there MUST NOT be a consensus layer over unrelated exchanges — that rebuilds the
global authority the architecture exists to avoid. The *form* of the log is shared
across platforms (the construction is domain-independent); each operator runs a
**separate** log over that form. Within a log, each anchor binds the sealed dialog's
file hash to the previous anchor:

```
anchor.hash = H(prev_anchor.hash ‖ canonical(anchor))
```

Editing or removing any anchored record breaks the chain from that point forward.
Anchors MUST be append-only; the protocol never updates or deletes them. `verify`
recomputes the chain and reports the first break.

### 5.2 Non-equivocation by witnessing

Cross-operator integrity comes from **witnessing**, not from a shared authority. An
operator publishes **signed, monotonic checkpoints** of its log head to independent
witnesses. An operator that shows two different histories thereby emits two
validly-signed, mutually-inconsistent checkpoints — a self-evident, attributable,
portable proof that it lied. This is the **Certificate Transparency** model
(RFC 6962), not consensus.

Witnessing makes equivocation **detectable, not prevented** — prevention would require
a larger authority at the core, which the architecture refuses — and detection is only
as strong as a verifier's reach to independent witnesses (eclipse is a standing
residual, §10). Reads SHOULD check inclusion proofs cheaply and automatically.

> **Status (honest):** the witness layer — checkpoint publication, independent
> witnesses, cross-operator inclusion proofs — is **intended, not yet built**. Until
> it exists, non-equivocation rests on there being a **single backend**. This is the
> single highest-leverage step toward real federation (§10).

The narrative text and any PII are **never** anchored (§9).

---

## 6. Reputation (LBTAS) — a covenant, not a score

The peer layer is the Leveson-Based Trade Assessment Scale. Reputation here is a
**covenant** — a standing promise not to harm — not a score. It is binary where it
counts: a member is in good standing or in breach, and the lowest rating, a `−1`, **is
the breach itself**, not a debit against a running total.

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

### 6.6 Gates whether, not how much

The covenant gates **whether** a member transacts on trust at all — never **how
much**. What it secures is *honesty, not capacity*: "I will not harm you" is not "I can
deliver what I promised." Non-delivery is itself a harm and belongs in the covenant;
but **bounding the size** of a commitment an honest actor may take on is a **limit**,
which belongs to the economy (§7.4), not the covenant. Let good standing buy a higher
ceiling and the harm distribution silently becomes a credit score — the bank through
the back door. The covenant gates the door; the limit sizes the room; keep them
separate.

---

## 7. The economy — escrow today, mutual credit intended

Agrinet's economy is **member-issued mutual credit** in intent; its settlement **today
is escrow**, which is the *opposite* of credit — collateralized in advance, no balance
ever negative, no trust ever extended. Escrow is named here as the **stand-in it is**,
and MUST be built so that turning credit on is **one policy switch, not a rebuild**
(§10).

### 7.1 The escrow gate (today)

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

### 7.2 Balances are a function of the record

Balances MUST be a **deterministic function of the sealed record**: each sealed
exchange moves **two balances that net to zero**. There MUST NOT be a balance store
that can drift from the ledger. Building escrow this way is what makes credit a switch
rather than a rebuild — the same net-zero balances the credit form needs already fall
out of the record.

### 7.3 The unit: denominated, not backed; earned, not bought

When credit is switched on, the unit is governed by lines that are **absolute**, and
which the escrow stand-in MUST already respect where it can:

- **Denomination is not redemption.** The unit is denominated one-to-one against fiat
  for **legibility only**. It MUST NOT be redeemable for fiat against reserves (that is
  a stablecoin and a regulated money-transmitter) and MUST NOT be purchasable with
  fiat. It is **earned** for value provided and is **spend-only**.
- **Sovereign and separate.** Each platform's currency is sovereign and separate. There
  MUST NOT be a cross-platform currency, nor a fixed convertibility between two
  platforms' units — that merges them and reintroduces cross-ledger double-spend. The
  peg is a **yardstick, never a bridge**.

### 7.4 Gate by covenant, cap by a separate limit

Issuance MUST be **gated by the covenant** (§6.6 — *whether*) and **capped by a
separate limit** (*how much*). The limit MAY derive from clean volume, declared
capacity, or a flat starting line — **anything but the harm distribution**. The
covenant gates the door; the limit sizes the room; conflating them rebuilds the credit
bureau.

### 7.5 Switching credit on (phased)

Credit cannot be cold-started. The intended path is three phases: (1) a **fiat
on-ramp** through the escrow marketplace, building and displaying an auditable record
of honest dealing; (2) **earned, non-redeemable** credit enters, *pulled* by a
value-prop (counter-cyclical, interest-free in-network liquidity), never *pushed* by a
button; (3) the internal economy thickens and fiat retreats to the perimeter. A real
**regulatory read is required before phase two**. Turning credit on is a deliberate,
still-unmade governance decision — not this specification's to make.

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

1. **Legibility — entrenched above all.** The system MUST ship documented and
   interpretively accessible enough that the people it governs can read it, fork it,
   and leave. The AGPL right to fork is empty unless the artifact is legible enough to
   exercise it; legibility is the single commitment whose loss collapses all the rest,
   and it is the condition under which every other guarantee here is true.
2. **Immutable reputation events.** Rating events are append-only; dismissals annotate,
   never erase (§6.3).
3. **The market lives in the protocol.** Matching, liquidity, counterparties, and the
   reputation record are protocol-level, so leaving a front end costs only the front
   end — the user keeps the market and the record (P3-011 §3.2).
4. **Portable records.** A user's reputation and history are portable across front
   ends.
5. **PII never in the commons.** Free-text narratives and any personally identifying
   information are **operator-local**: held at the front end, referenced (not carried)
   by protocol transmissions, never anchored on the chain, never federated, and read
   only by a record's own parties and the operator's adjudicator.

Everything not on this list is mutable by ordinary amendment.

---

## 10. The honest ledger — what is built, not built, and open

The method forbids performing the absence of a gap. This section names them.

**Built (single backend).** The per-operator record (Mycelium), reputation (LBTAS),
escrow settlement, and rotating-key operator authentication.

**Intended, not yet built.**

- **The witness layer** (§5.2) that makes the record non-equivocable across *multiple*
  operators — signed checkpoints, independent witnesses, cross-operator inclusion
  proofs. The highest-leverage step toward real federation; until it exists,
  non-equivocation rests on there being one backend.
- **Mutual credit** (§7). Settlement is escrow, the opposite of credit; turning credit
  on is the phased, still-unmade decision of §7.5, with the Sybil-resistance,
  denomination, and regulatory walls attached.

**Open / standing residuals.**

- **Equivocation is detectable, not prevented** (§5.2), and only as strong as a
  verifier's reach to independent witnesses; eclipse is a residual. A fix MUST NOT
  introduce a larger authority at the core.
- **Computation honesty is out of scope.** The ordered, signed, sealed record proves
  the *sequence and integrity* of an exchange — no step skipped, reordered, injected,
  or altered after sealing. It does **not** attest the honesty of the computation
  *inside* a single transmission: an operator running modified logic can emit a
  well-formed, correctly-ordered, correctly-signed transmission whose *contents* are
  the product of a rigged computation (a skewed match, a manipulated price). Closing
  this needs reproducible computation, zero-knowledge proofs, or trusted execution — a
  research item. The checks that remain real against it are **legibility and cheap
  exit**; where it leaks no PII, anchoring the *claims* (inputs and outputs) in the
  record makes them auditable even when the computation is not proven.
- **Reputation portability across platforms is undecided** — available and lighter
  than currency unification, but a governance/values call, not a protocol default. The
  interfaces (portable identity, witnessed-log read) SHOULD be built so portability
  stays **cheaply reversible in both directions** without committing the network to it.
- **The governed are not yet the governing at the core**; membership is purchased
  today. Named as interim work (§11), not concealed; the identity/membership layer MUST
  NOT bake "purchased" in, so that earned or universal membership can replace it
  without re-architecting.
- **Sovereign compute buys mechanical, not economic, exit** — the coordinator and
  reputation cold-start can recentralize the substrate the way deliverability
  recentralized email. Portable reputation and transparent, contestable fees are the
  mitigations; the mechanism alone is not.

---

## 11. Governance, versioning, and contestation

Each layer is governed by **the cost of leaving it**: **voice** at the peer layer,
where a harm claim is cheap to raise and answer; **exit** at the front ends and the
substrate, which live below any single operator so leaving one costs only that one; and
**contestation** at this specification — the one layer no one can cheaply leave,
because forking it splits the liquidity. The core is disciplined not by exit but by
staying minimal, legible, and permanently contested, under a named steward (NTARI, a
501(c)(3), whose deepest commitments are entrenched per §9). The gap that the governed
are not yet the governing at the core (§10) is named as interim work, not concealed.

The protocol version is the `v` header field. Because the specification cannot be
cheaply left, it is the one place the contest must run permanently:

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
| §4 dialog file, append-as-received, seal | **Implemented** (`mycelium_log` + `mycelium_anchors`; `append`/`seal`/`annotate`; `sealIfComplete` on complete+quiescent) | — |
| §4.4 timeout default (+2) | **Implemented** (`applyRatingTimeouts` hourly sweep: seller review window + buyer confirmation window; `system` rater, `category='timeout'`, `defaulted` count in reads) | — |
| §5 Mycelium hash chain | **Implemented** (sealed dialog-file model) | — |
| §6 LBTAS distribution / role-scoped / both-ways contest / annotate-not-hide | **Implemented** (`services/lbtas`, `ratingRepository`, `ratingRoutes`) | — |
| §6.3/§9 narrative operator-local | **Implemented structurally** (`rating_narratives`, parties/adjudicator only) | Physical relocation to the front end's own store when Fruitful gains one; ensure federation never replicates narratives. |
| §7 escrow gate / maturity / tranches | **Implemented** (`transactionService`) | — |
| §9 market/reputation in the protocol, portable | **Implemented** (Agrinet backend holds posts/transactions/ratings/escrow/ledger; Fruitful is swappable UI) | Cross-node reputation federation (multi-backend) not built; single-protocol-many-frontends holds today. |
| §1 substrate / no hosting chokepoint | **Partial** (runs on SoHoLINK-capable infra; usually a shared backend) | Package for participant-owned deploy; document the self-host path. |
| §5.1 per-operator log | **Implemented** (single backend) | — |
| §5.2 witnessing / cross-operator non-equivocation | **Not built** (intended) | Signed checkpoints, independent witnesses, inclusion proofs (Certificate Transparency). Highest-leverage federation step. |
| §7.2 net-zero balances from the record | **Not conformant** | Balances are a mutable `wallets.balance` (direct `UPDATE`); `wallet_history` is an audit trail, not the source of truth. Delta: append-only wallet-entries ledger, balance = derived sum, each exchange nets to zero. |
| §7.3 non-redeemable / non-purchasable / denominated-not-backed | **Flag — purchasability** | No cash-out path exists (conformant on redemption). But Stripe payments credit a *general spendable wallet* (`webhook.js` "Stripe deposit") — fiat buying in-network balance. Delta: bind each payment to a specific transaction's escrow; retire the general fiat top-up (§10, tension protocol). |
| §7.4 covenant gate + separate limit | **Not built** (credit off) | Add a limit instrument separate from the harm distribution, gated by the covenant. |
| §11 entrenchment / double supermajority | **Governance** (NTARI bylaws) | Out of code scope. |

## 13. Conformance to the Janus-Facing Architecture standard (informative)

The seven checks of the JFA builder's guide are the standard; a system is NTARI
software only if all hold. Agrinet's honest status against each:

| # | JFA check | Agrinet status |
|---|---|---|
| 1 | **Mutual credit, not banking** | **Stand-in, with a flag.** Settlement is escrow (§7), labeled as the opposite of credit. Two rails are not yet conformant: balances are a mutable store, not a net-zero ledger (§7.2); and a fiat *deposit* path funds a general spendable wallet (§7.3) — purchasability, to be corrected to per-transaction escrow funding. No cash-out path exists. Credit itself is off (§10). |
| 2 | **Sovereign substrate** | **Partial.** Runs on participant-ownable infrastructure (SoHoLINK); usually a shared backend today, with no architectural chokepoint (§1). |
| 3 | **Witnessed, legible record** | **Partial.** Immutable, tamper-evident, PII-free, forgive-not-hide (§4–§6, §9); witnessing across operators is intended-not-built (§5.2, §10). |
| 4 | **Reputation as covenant** | **Conformant.** Distribution never averaged, contestable both ways, gates whether-not-how-much (§6). |
| 5 | **Governed by the cost of leaving** | **Conformant in design.** Voice at the peer layer, exit at front ends/substrate, contestation at this minimal spec (§11). |
| 6 | **Minimal, contested, stewarded core** | **Conformant.** Minimal entrenched guarantees (§9), permanent contestation (§11), NTARI as named steward; the governed/governing gap named as interim (§10, §11). |
| 7 | **Legible above all** | **In progress.** This spec, the LBTAS and Mycelium specs, and per-repo READMEs are the legibility deliverable; legibility is entrenched (§9.1). |

---

*Network Theory Applied Research Institute, Inc. — 501(c)(3) — info@ntari.org*
*This specification is free documentation under the project's AGPL-3.0 commons; it is meant to be read, reimplemented, and contested.*
