# Agrinet / Fruitful — Phase Plan & Decision Record

_Last updated: 2026-06-29_

## North star

**Agrinet** is the shared, AGPL-3.0 **backend / network protocol**. **Fruitful** is the
Network Theory Applied Research Institute's official **frontend** for it. The goal is a
community of independent, AGPL-licensed frontend operators (Fruitful, and others) all
federating through the one neutral Agrinet backend — so the network effect lives in the
shared backend and operators compete on UX, instead of the community fragmenting into
incompatible proprietary silos.

| Thing | Repo | Role |
|---|---|---|
| **Agrinet** | `NTARI-RAND/Agrinet` | Backend / network / protocol (Express + MariaDB + Redis). Runs on **NTARIHQ**. |
| **Fruitful** | `NTARI-RAND/fruitful` | Frontend UI (Next.js). Split out of the monolith via subtree (history preserved). |
| **Docs** | `NTARI-RAND/agrinet-docs` | Docusaurus site → GitHub Pages. Moving `theagri.net` → `docs.theagri.net`. |

Source: derived from upstream `carloszambonii/agrinet-brazil` (scanned clean of malware before import).

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

### Phase 2 — Post taxonomy + forms — ⬜ TODO
Implement the whitepaper post types and create/list flows:
Service (`la`/`lr`/`pr`/`cr`/`es`), Direct Market, Product, Agrotourism, Consumer/Producer Plans;
use-categories food/pharma/fiber/chemical/mineral/ornamental. Backend schema changes.

### Phase 3 — LBTAS — ⬜ TODO
Vendor the v2 `lbtas.ts` (`LevesonRatingSystem`) into the Agrinet backend; swap its JSON-file storage for the DB; one `−1…+4` rating per transaction; distribution-based, no averaging, no auto-ban.

### Phase 4 — Plans / PING / settlement + escrow gate — ⬜ TODO
Consumer/Producer plans, PING schedule + calendar, delayed-settlement holds, contract shares, PING updates with files. **Wire the LBTAS gate into the escrow-release path** (`releaseTx`): no release signal to Stripe until the consumer's rating is in.

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
