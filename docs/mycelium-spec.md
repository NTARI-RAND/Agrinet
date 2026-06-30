# Mycelium: The Immutable Transaction-Record Ledger

**Network Theory Applied Research Institute**
Document ID: P3-013 · Version: 0.1 (Draft) · June 2026
*Companion to P3-011 v2 (Janus Facing Applications), P3-012 (Agrinet Protocol Specification), and the LBTAS specification.*

---

## 0. Purpose

Mycelium is the **immutable, tamper-evident record of what happened** between
participants — the transactions, ratings, and adjudications that make up an exchange.
P3-011 v2 calls a reputation record a *sensor*: a thermometer that surfaces harm
rather than a thermostat that acts on it. Mycelium is the substrate that sensor reads
from. Its single job is to make the record of an exchange **legible, portable, and
impossible to quietly rewrite**, so that the contest the orchestration software runs
(P3-011 §2) is run over facts no party can later edit in their own favor.

Two design commitments follow directly from the JFA argument and govern everything
below:

1. **Annotate, never erase (P3-011 §3.1).** A front end may forgive harm; it must
   never be able to hide one. Mycelium has no update and no delete. A dismissal is a
   new record, not an edit.
2. **No PII in the commons (P3-011 §3.1, §3.2).** The ledger anchors structural facts
   and references — never the free-text narrative or any personally identifying
   information. The non-erasable record is, by construction, PII-free; the erasable
   PII lives at the front end. This is what lets an immutable record coexist with
   privacy law and a right to be forgotten (P3-011 §6, research agenda).

Mycelium does **not** attest the honesty of a computation *inside* a record (§9). It
attests the **sequence and integrity** of the record itself.

---

## 1. The unit of record: the dialog

The atomic record is not a single event but a **dialog**: one append-only file per
exchange — a transaction, a contract, or a negotiation — between users (and, where an
adjudicator intervenes, them too). A dialog is always **anchored to a post** (of any
type); there are no free-floating records.

A dialog accumulates the *whole story* of one exchange in order: the opening, the
messages, the transaction lifecycle (payment, tranche releases, settlement,
transfer), the PING progress reports, the ratings, and any audit. The immutable unit
is therefore the complete exchange, not a scattering of disconnected events.

A dialog has two phases: **open** (accumulating) and **sealed** (frozen and anchored).

---

## 2. Transmissions and per-transmission integrity

A dialog is built from **transmissions** — the atomic, operator-signed messages
defined by P3-012 §3. Each transmission carries a header-first canonical form
(`v · operator_id · dialog_id · seq · type · actor_id · actor_role · ts · nonce`,
then body, then two operator signatures). Only protocol fields and **references**
appear in a transmission's canonical bytes; free text (message bodies, the −1
narrative) is operator-local and is referenced, never carried (§6, P3-012 §9).

Let `C_i` be the canonical bytes of the `i`-th transmission in a dialog. Each
transmission is signed by the operator under the rotating 7-key / 2-signature scheme
(P3-012 §2), giving **authenticity** (who said it) and, via the bound
`dialog_id`/`seq`, **position** (where it sits).

---

## 3. The intra-dialog chain (bits recorded as received)

As each transmission arrives and validates, it is appended to the open dialog file and
folded into a running **intra-dialog hash**, so the record is tamper-evident
incrementally — not only at the end:

```
h_0 = H(C_0)
h_i = H(h_{i-1} ‖ C_i)        for i ≥ 1
```

`h_i` is the dialog's head after the `i`-th transmission. Because each transmission
chains to the prior one and is independently signed, altering, reordering, dropping,
or injecting any transmission in an open dialog is detectable immediately — the head
no longer recomputes, or a signature fails (P3-012 §8, out of protocol). This is the
integrity of "bits recorded as they are received."

`H` is SHA-256 in this version (algorithm-agile; the construction is unchanged if the
hash is upgraded).

---

## 4. Sealing: complete and quiescent

A dialog seals — closes, hashes, and anchors — only when it is **both complete and
quiescent**. Money finality and record finality are distinct: a ready-market purchase
settles funds quickly but its dialog seals **late**, when the conditions below hold.

### 4.1 Complete — both parties have a rating

A dialog is complete when **every party owed a rating has one**, in both directions
(buyer↔seller). A party that does not rate within its **rating window** does not block
completion: on window expiry the protocol emits a **system default rating of `+2`**
("Basic Satisfaction"). Silence is read as an exchange that completed without
complaint — not as praise, not as harm.

A timeout default is a `rating` transmission with `actor_role = system`, **marked as a
timeout default**. It is distribution-distinguishable from an affirmed party rating in
every read (as a dismissal is), so a reputation built partly from silence is never
mistaken for one built from affirmation. (`+2` is the conservative default — it does
not inflate reputation; `+3` is the documented alternative. This is the only tunable
constant in the seal rule.)

### 4.2 Quiescent — no open audit on either side

A `−1` ("No Trust") from **either** party opens an `audit_open` and **holds the seal
open**. The dialog cannot seal until a matching `audit_resolved` (upheld, or
dismissed-with-annotation) is appended. Sealing therefore waits for adjudication to
finish, in both directions — the record is never frozen mid-dispute, and a harm claim
is never sealed away before it has been answered (P3-011 §3.1, harm is contestable
both ways).

### 4.3 The seal

When complete and quiescent, a final `dialog_seal` transmission:

1. fixes the **file hash** `F = h_{n-1}` (the intra-dialog head after the last content
   transmission);
2. records `F` together with the previous sealed dialog's anchor hash;
3. **anchors** the seal on the global chain (§5).

After sealing, the file is immutable.

---

## 5. The inter-dialog chain (the ledger)

Sealed dialogs are linked into one global, append-only chain. Each **anchor** binds a
sealed dialog's file hash to the previous anchor:

```
anchor = { dialog_id, file_hash F, sealed_at, prev_anchor_hash }
anchor.hash = H(prev_anchor_hash ‖ canonical(anchor))
```

This is the Mycelium ledger: a hash chain of sealed exchanges. Editing or removing any
anchored dialog breaks the chain from that point forward, so the ledger is
tamper-evident as a whole. Anchors are append-only; there is no update and no delete.
A `verify` walks the chain, recomputes every link, and reports the first break.

Two chains, two scopes: the **intra-dialog** chain (§3) protects the order and content
of one exchange as it is built; the **inter-dialog** chain (§5) protects the set of
completed exchanges against later rewriting.

---

## 6. What is anchored — and what is not

Anchored: structural facts and references only — transmission types, sequence,
operator and actor identifiers (pseudonymous `user_id`s), amounts, rating *levels*,
hashes, timestamps.

**Never anchored, never federated, never in the commons:** the free-text rating
narrative and any personally identifying information. These are **operator-local**
(P3-012 §9): held at the front end, referenced by id from a transmission, and read
only by a record's own parties and the operator's adjudicator. Because the hashed
canonical transmissions contain references rather than text, **no PII enters the hash
at any level** — the intra-dialog head, the file hash, and the chain anchors are all
PII-free.

Consequence (directly addressing P3-011 §6): the immutable layer carries no personal
data, so it can be permanent without colliding with privacy law; the personal data
lives in the erasable, front-end-local layer. "Data sovereignty" here is the right to
carry, answer, and annotate your record — not the right to delete another party's
attestation about a shared exchange.

---

## 7. Post-seal adjudication: annotate, never erase

A dismissal or finding that arrives **after** a dialog has sealed MUST NOT touch the
sealed file. It is recorded as a **new, separately anchored record that references the
sealed dialog by its file hash** — an annotation, not an edit. The original sealed
record and its later annotation are both permanent and both visible downstream. A
reputation read computes the *active* distribution (excluding dismissed events) while
still surfacing every dismissed event, annotated with who dismissed it and why
(LBTAS; P3-011 §3.1). Forgiveness is expressible; concealment is not.

---

## 8. Verification and portability

- **Chain integrity:** recompute every anchor from `prev_anchor_hash ‖ canonical(anchor)`;
  the first mismatch localizes tampering to a dialog.
- **Record integrity:** recompute a sealed dialog's intra-dialog chain from its
  transmissions and compare to the anchored `file_hash`; recompute each transmission's
  operator signatures.
- **Portability:** because the ledger and the reputation events live in the protocol
  (not in any front end), a participant's record is portable across front ends —
  leaving a front end costs the front end and nothing else (P3-011 §3.2). Verification
  requires only the protocol's records and the operators' registered public keys, both
  of which any participant or reimplementation can read.

---

## 9. Guarantees and non-guarantees

**Guarantees.** Given the chains and signatures above, Mycelium proves: no transmission
in a dialog was altered, reordered, dropped, or injected; no sealed dialog was changed
after sealing; no anchored dialog was removed or re-ordered in the ledger; and every
transmission was issued by a registered operator. The *sequence and integrity of the
record* are sound.

**Non-guarantees.** Mycelium does **not** prove that the computation *inside* a
transmission was honest. An operator running modified logic can emit a well-formed,
correctly-ordered, correctly-signed, faithfully-anchored transmission whose *contents*
are a rigged match or a manipulated price. Closing that gap needs reproducible
computation, zero-knowledge proofs, or trusted execution, and is out of scope for
v0.1. The checks that remain real against it are the JFA checks: legibility and cheap
exit — a front end whose outputs are suspect can be left, and a reimplementation built
from P3-012 can verify the record independently and stay on the network.

---

## 10. Relationship to the other layers

- **LBTAS (peer layer):** rating events are Mycelium records; the distribution is read
  from them. Immutability + annotate-not-erase + both-ways contestation (P3-011 §3.1)
  are enforced here.
- **Escrow / settlement:** `paid`, `tranche_released`, `escrow_settled`, `refunded`,
  `contract_transferred` are dialog transmissions; the money lifecycle is part of the
  sealed record.
- **Operator keys (P3-012 §2):** supply per-transmission authenticity; Mycelium supplies
  order and immutability.
- **Federation:** anchors and structural records MAY federate across protocol nodes;
  operator-local narratives MUST NOT.

---

## 11. Worked example

*Ready-market purchase.* `dialog_open` (post anchor) → `transaction_created` →
`paid`. Buyer confirms with a `+3` `rating` → `escrow_settled` to the producer
(money finalizes). The producer has not yet rated the buyer; the dialog stays **open**
through the producer's window. The window expires → a marked `+2` system `rating` is
emitted. No audit is open → the dialog is now complete and quiescent → `dialog_seal`
fixes the file hash and anchors it. *Settlement was fast; the seal was not.*

*Disputed contract.* A `plan_producer` contract runs through PINGs and tranche
releases. At delivery the buyer rates `−1` with a narrative (operator-local) →
`audit_open`; the seal is held. An adjudicator dismisses it as bad-faith →
`audit_resolved(dismissed)`; the dismissed `−1` remains visible, annotated. The
producer rates the buyer `+2`. Complete and quiescent → seal + anchor. The sealed file
contains the dispute and its dismissal — the forgiveness is on the record, not hidden.

---

## 12. Implementation status (informative)

| Element | Status | Delta |
|---|---|---|
| Hash-chained append-only ledger, `verify` | **Implemented** (`services/myceliumService.js`) at **per-event** granularity | Migrate the unit from event to **sealed dialog file** (§1–§5). |
| Money-lifecycle events recorded | **Implemented** (after-commit hooks) | Fold into the dialog file as transmissions. |
| Dialog open→seal lifecycle | **Not yet** | Build the open file, intra-dialog chain (§3), and seal (§4). |
| Seal = complete **and** quiescent; timeout → marked `+2`; `−1` holds seal | **Not yet** | Rating-window timeout sweep; audit-gated seal. |
| Per-transmission operator signing of intra-dialog events | **Partial** | Sign messages/events, not just operator-management calls. |
| PII never anchored; narrative operator-local | **Structurally implemented** (`rating_narratives`; references only in records) | Relocate narrative store to the front end when Fruitful gains one; ensure federation excludes it. |
| Annotate-not-erase (active vs dismissed) | **Implemented** (LBTAS reads) | Express late dismissals as post-seal anchored annotations (§7). |

---

*Network Theory Applied Research Institute, Inc. — 501(c)(3) — info@ntari.org*
*Free documentation under the project's AGPL-3.0 commons — meant to be read, reimplemented, and contested.*
