# Agrinet / Fruitful — Phase Plan & Decision Record

_Last updated: 2026-06-29_

## North star

**Agrinet** is the shared, AGPL-3.0 **backend / network protocol**. **Fruitful** is the
Network Theory Applied Research Institute's official **frontend** for it. The goal is a
community of independent, AGPL-licensed frontend operators (Fruitful, and others) all
federating through the one neutral Agrinet backend — so the network effect lives in the
shared backend and operators compete on UX, instead of the community fragmenting into
incompatible siloed, copyleft instances.

| Thing | Repo | Role |
|---|---|---|
| **Agrinet** | `NTARI-RAND/Agrinet` | Backend / network / protocol (Express + MariaDB + Redis). Runs on **NTARIHQ**. |
| **Fruitful** | `NTARI-RAND/fruitful` | Frontend UI (Next.js). Split out of the monolith via subtree (history preserved). |
| **Docs** | `NTARI-RAND/agrinet-docs` | Docusaurus site → GitHub Pages. Moving `theagri.net` → `docs.theagri.net`. |

Source: derived from upstream `carloszambonii/agrinet-brazil` and the original work of Calvin Secrest https://calvinsecrest.com/, and the tireless volunteers at the Network Theory Applied Research Institute.

---

## Decisions log

- **Branding:** Agrinet = backend/network; **Fruitful = frontend**. UI rebranded to Fruitful.
- **Repo split:** Fruitful lives in its own repo (`NTARI-RAND/fruitful`), subtree-split from the monolith with history. Agrinet keeps `backend/` + `infra/`.
- **Tabs:** Home · Marketplace · My Farm · My Services · My Contracts. Chat → a Messages icon; Admin → a gear (admins only); Profile/Wallet → the avatar.
- **LBTAS:** one `−1…+4` rating **per transaction**. **No averaging, no auto-ban** (matches the v2 `lbtas.ts` in `Leveson-Based-Trade-Assessment-Scale`, which is distribution-based and ban-free). Used for human-governed visibility, not automated moderation.
- **Escrow gate:** Stripe escrow **stays**. The consumer's LBTAS rating must be received **before** the release signal is sent to Stripe. The producer's reviewer-rating is post-hoc (3-month window) and does **not** hold funds.
- **Security / "operator keys":** the whitepaper's UI key-dialog authenticates **operators** (frontends) to Agrinet — it is the platform boundary, not user login (users stay on email/2FA). **Implement PQ transport (hybrid-PQ TLS, which the Cloudflare tunnel already provides) + PQ-authenticated operator keys (signed tokens: Ed25519 → ML-DSA via a vetted lib).** **Do NOT** hand-roll QC-MDPC McEliece (decoding-failure/reaction-attack risk, non-standardized). Keep the protocol _shape_ (rotating 7-key / 2-per-transmission handshake), swap the primitive.
- **Mycelium:** kept — lives in the **Agrinet backend** as an immutable transaction record.
- **ML monitoring (whitepaper §5.3):** removed.
- **Hosting:** full interactive app served from **NTARIHQ → the internet at `theagri.net`** via a **Cloudflare named tunnel** (no port-forwarding, auto-TLS). Requires moving `theagri.net` DNS from Wix to Cloudflare. Docs move to `docs.theagri.net` to free the apex.
- **AGPL compliance:** footer carries the "Appropriate Legal Notices" (copyright, no-warranty, license link) + Corresponding-Source links to `NTARI-RAND/fruitful`, `NTARI-RAND/Agrinet`, and the `carloszambonii/agrinet-brazil` upstream.

---

## Phases

### Phase 0 — Import, harden, host locally — ✅ DONE
- Scanned `carloszambonii/agrinet-brazil` (clean), imported as branch `import/brazil`.
- Patched deps: `next@14.2.35` (cleared critical), backend `npm audit fix` → 0 production vulns.
- Local hosting on NTARIHQ via `infra/docker/docker-compose.local.yml` (http://localhost:8090), validated end-to-end.
- Stripe: live secret key configured + verified (webhook still `whsec_dummy`).
- Uploads: switched from Cloudflare R2 to **local disk** (`uploads_data` volume, served at `/api/uploads/...`).
- AI responder: switched **OpenAI → Anthropic Claude** (`@anthropic-ai/sdk`, default `claude-opus-4-8`). `ANTHROPIC_API_KEY` deferred (Console lockout) — responder falls back gracefully.
- i18n: full English translation + 🇺🇸/🇧🇷 language switcher (default English).

### Phase 1 — Branding, IA, repo split — ✅ DONE (pending PR merges)
- **1B:** subtree-split `frontend/` → `NTARI-RAND/fruitful` (history preserved). Backend stays on NTARIHQ.
- **1A:** rebrand Agrinet→Fruitful; the five tabs; scaffolded `/farm`, `/services`, `/contracts`; AGPL footer with all source links. Build passes (11 routes).
- **Remaining (org-admin actions):** merge `phase-1a → seed` via PR; establish/rename the canonical default branch (`seed` → `main`); flip the repo to public when ready.

### Phase 2 — Post taxonomy + forms — ✅ DONE
Backend: unified `posts` table (`post_type` + indexed common columns + JSON `payload`), per-type validation, `/posts` API, local-disk media at `/posts/upload-media`.
Frontend (`fruitful`, branch `phase-2-forms`): config-driven create flow (`lib/postTypes.js` + `NewPostModal`) for all six types — Service (`la`/`lr`/`pr`/`cr`/`es`), Direct Market, Product, Agrotourism, Consumer/Producer Plans; `MyPosts` owner views on My Farm/My Services; Marketplace switched to the `/posts` General Broadcast with post-type pills. Use-categories food/pharma/fiber/chemical/mineral/ornamental.

### Phase 3 — LBTAS — ✅ DONE
Vendored the v2 LBTAS model into the Agrinet backend as a DB-backed **event store** (`lbtas_ratings`), replacing the old `reputation_score` sum. Reputation is a **distribution** computed on read (per-level counts + total + transaction count + first/last rated), **never averaged**; **no auto-ban**. Bidirectional (`buyer`/`seller`), one rating per direction per transaction. A `−1` ("No Trust") requires a justifying comment ≤500 words, enforced at the boundary. New `/ratings` API: `scale` (public), `me`, `me/pending` (prompt feed), `users/:id` (public distribution), `transactions/:id` (review — parties/admin, fail-closed), `report` + `harm-flagged` (admin). The Bayesian-averaging `utils/reputation.js` is now a throwing deprecation stub.

### Phase 4 — Plans / PING / settlement + escrow gate — 🟨 IN PROGRESS
- **Escrow gate — ✅ DONE.** The consumer's (buyer's) LBTAS rating settles the held funds. A `0…+4` **auto-releases** to the seller (`_settleEscrow`, shared helper inside the caller's DB transaction; `source: lbtas_gate`). A **`−1` ("No Trust")** does NOT release — it **freezes the funds and auto-opens a dispute** (the mandatory `−1` comment becomes the dispute reason) for manual admin resolution. A seller-initiated `releaseEscrow` is **gated** on `buyer_rated` (fallback). The producer's post-hoc rating moves no money.
  - **Admin resolution now moves real money** (`transactionService.resolveDispute` → `POST /admin/disputes/:id/resolve`): `release` settles escrow to the seller, `refund` returns the held amount to the buyer (the prior endpoint only flipped a status string — a money-less stub). Also fixed: `openDispute` was never exported, so the buyer's manual dispute button was dead.
  - Verified end-to-end: `+4` → seller credited; `−1` → frozen + dispute opened (seller not paid); admin `release` → seller credited; admin `refund` → buyer credited; seller-release blocked pre-rating; double-release rejected.
  - Frontend (`RatePrompt`): value-aware — `−1` shows a "opens a dispute & freezes payment" warning and a "Submit & open dispute" CTA; `0…+4` shows the release note and "Confirm & release". Buyer's tx action is "Confirm & rate"; seller's "Liberar" only appears once the buyer has rated.
- **Role-scoped reputations + admin override — ✅ DONE.** A user holds a **separate** LBTAS reputation **per role** (`rated_role`: `market_seller`/`market_buyer`, `service_provider`/`service_client`, `agrotourism_host`/`agrotourism_guest`, `plan_producer`/`plan_backer`, …), derived from the transaction's `post_type` + which side the rated user was on. Reputation reads return one distribution per role (`ratingRepository.getUserReputation().roles`); frontend renders them via `ReputationPanel`. Ratings can be **voided** (`voided`/`voided_by`/`voided_reason`; excluded from all distributions). On a bad-faith finding, `resolveDispute(..., {voidBuyerRating, adminRating})` voids the buyer's rating and lets the admin issue a replacement rating of the seller (`rater_role='admin'`); the seller's own `−1` of the buyer still stands. Verified end-to-end. **Admin UI for the void/issue action is still TODO** (endpoint `POST /admin/disputes/:id/resolve` accepts `voidBuyerRating`/`adminRating`).
- **Remaining — ⬜ TODO:** Consumer/Producer plan contracting flow, PING schedule + calendar, delayed-settlement holds, contract shares, PING updates with files.

### Phase 5 — Protocol / operator keys / Mycelium — ⬜ TODO (research-grade, last)
Transmission grammar; **operator registration + PQ-authenticated rotating keys** (hybrid-PQ TLS + signed tokens via a vetted lib — not hand-rolled McEliece); **Mycelium** immutable transaction-record ledger in the backend. ML monitoring is out of scope.

---

## Open items / next actions
1. **Merge `phase-1a → seed`** in `NTARI-RAND/fruitful` (PR; org ruleset requires it) and decide the canonical default branch name.
2. **Hosting:** move `theagri.net` DNS to Cloudflare; create the tunnel + token (`CF_TUNNEL_TOKEN` in `.env`); public hostname `theagri.net → nginx:80`; run `docker compose -f docker-compose.local.yml -f docker-compose.tunnel.yml up -d`.
3. **Docs:** migrate `agrinet-docs` `theagri.net → docs.theagri.net`.
4. **Fruitful deploy:** set `NEXT_PUBLIC_API_URL` to the Agrinet public API once Fruitful is deployed independently of the backend.
5. **Stripe:** add a real `STRIPE_WEBHOOK_SECRET` (or use test keys) before taking live payments.
6. Proceed to Phase 2.
