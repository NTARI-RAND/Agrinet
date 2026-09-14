> lipu ni li lipu lili pi kulupu, tan lipu lawa NTARI P2-002. lipu suli li `README.md` — ona li lon toki Potuke (tenpo sitelen: 2026-07-29). ilo sona li pali e lipu ni; jan pi kulupu li ken lukin e ona lon tenpo kama, tan P2-002 kipisi 3.1.
>
> **English:** Condensed community rendering under NTARI policy P2-002. The complete document is the original `README.md` (Portuguese original, snapshot 2026-07-29). Machine-assisted draft pending community review per P2-002 §3.1.
>
> sina lukin e pakala lon toki ni la o pona e ona: o pali e "fork" lon
> https://github.com/NTARI-RAND/Agrinet, o pana e "pull request". pana sina li
> pona tawa mi mute.

# ilo Agrinet — lipu lili

## ni li seme?

ilo Agrinet li tomo esun lon ilo sona, tawa ma Brasil. jan li esun e kasi moku e ijo pi ma kasi. lawa wan taso li lon ala: kulupu mute li ken jo e ilo Agrinet ona sama, li ken pana e sona tawa kulupu ante ("federation").

## ona li pali e seme?

jan pana li pana e lipu esun. jan kama jo li pana e mani kepeken ilo "Stripe". mani li awen lon poki ("escrow"). ijo li kama tawa jan kama jo la, jan pana li open e poki, li kama jo e mani. jan tu li ken toki lon tenpo sama. ilo li lukin e jan powe. pakala li kama la, jan lawa li ken pini e utala, li ken pana sin e mani.

```
Listing criado pelo seller
        |
        v
Buyer inicia transacao
        |
        v
Pagamento via Stripe (PaymentIntent)
        |
        v
Webhook confirma pagamento --> transaction: paid
        |
        v
Seller libera escrow
        |
        v
Wallet do seller creditada --> transaction: completed
```

ilo insa li ni: Node.js, Express, MariaDB, Redis, Socket.IO, Stripe, Next.js 14, Docker, GitHub Actions, Cloudflare R2.

## jan seme li kepeken ona?

jan pali kasi pi ma Brasil, jan pi kama jo moku, jan lawa pi tomo esun, en jan pali pi kulupu ante.

## tenpo ni la ilo li lon seme?

pali mute li pini: nasin pi kama insa, lipu esun, alasa, escrow, poki mani, toki, ilo pi lukin jan powe, tomo lawa, federation, sinpin, en nasin pi pana sin (CI/CD).

pali kama li ni: nasin mani "PIX", lipu esun pi kasi (sona pi mama kasi), en nimi ma pi ilo kepeken nasin awen HTTPS.

## lipu ante

lipu sona ale li lon poki `docs/`, li lon toki Potuke: [auth.md](./auth.md), [listings.md](./listings.md), [transactions.md](./transactions.md), [wallet.md](./wallet.md), [chat.md](./chat.md), [fraud.md](./fraud.md), [admin.md](./admin.md), [federation.md](./federation.md), [schema.md](./schema.md), [testing.md](./testing.md), en ante mute. lipu `README.md` li pana e nimi ale.

## sina wile pali kepeken mi?

lipu pali ale li open tawa jan ale lon ilo "GitHub". o lukin e lipu sona, o pali e ijo sin, o toki e pakala tawa mi. sina sona e toki pona la, o pona e lipu ni kin.
