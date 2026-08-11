# Agrinet — esun pi ijo ma

> **toki pona:** lipu ni li lipu lili. ona li tan nasin NTARI "P2-002". lipu suli li lipu "README.md" pi open (tenpo pi awen sitelen: 2026-07-29). lipu suli ni li kepeken toki Potuke, toki Inli ala. ilo sona li pali e lipu lili ni. kulupu li kama lukin e ona kepeken nasin "P2-002" wan 3.1.
>
> **English:** This is a condensed community rendering produced under NTARI policy P2-002. The complete document is the original README.md (snapshot 2026-07-29) — note that this original is written in Brazilian Portuguese, not English. Machine-assisted draft pending community review per P2-002 section 3.1.
>
> sina lukin e pakala lon toki ni la o pona e ona: o pali e "fork" lon
> https://github.com/NTARI-RAND/Agrinet, o pana e "pull request". pana sina li
> pona tawa mi mute.

---

## ni li seme?

Agrinet li ilo esun. jan ale li ken lukin e lipu pali ona, li ken kepeken e ona. ona li pali tawa jan pi ma Brazil.

jan ni li kepeken e ona: **jan pali ma** li pana e ijo ona (pan, kili, soweli, ilo pali). **jan kama jo** li alasa e ijo, li kama jo e ona. **jan pi pana pali** li pana e pali ona tawa jan ante.

Agrinet li kama tan pali pi kulupu NTARI: https://github.com/NTARI-RAND/Agrinet — jan Carlos Zamboni li ante e ona tawa ma Brazil.

ilo li lon ni: https://agrinet.duckdns.org

---

## ona li pali e seme?

- **mani awen** — ilo "Stripe" li jo e mani lon tenpo lili. jan kama jo li pana e mani tawa ilo. jan esun li pana e ijo. ni la mani li kama tawa jan esun. ijo li kama ala la, mani li tawa sin jan kama jo.
- **poki mani** — jan li ken lukin e mani ona, e lipu pi mani ale ona.
- **toki** — jan tu li ken toki, li kama jo e toki lon tenpo lili.
- **awen tan jan ike** — ilo li lukin e pali. ona li pana e nanpa pi pona jan tawa jan lawa. pali ike la, jan lawa li kama sona.
- **kulupu ilo** — ilo Agrinet mute li ken kulupu. ilo wan li pana e lipu esun, e sona pi jan ike, tawa ilo ante.
- **lipu pi jan lawa** — jan lawa li ken weka e lipu ike, li ken pona e utala pi jan tu.
- **sitelen** — jan li ken pana e sitelen pi ijo ona.

---

## sina open e ona kepeken nasin seme?

nasin pona li kepeken ilo "Docker":

```bash
git clone https://github.com/CarlosZambonii/Agrinet-Brazil
cd Agrinet-Brazil

# Configurar variáveis de ambiente
cp backend/.env.example .env
# Editar .env com JWT_SECRET, STRIPE_*, R2_*, API_KEY

# Subir o stack completo
cd infra/docker
docker compose up -d
```

ni la ilo li lon:

- lipu jan: http://localhost:3000
- ilo "API": http://localhost:5000
- ilo "Grafana": http://localhost:3001

sina wile pali kepeken ilo sina taso la, o jo e ilo "Node.js 20+", e ilo "MariaDB", e ilo "Redis". nasin ale li lon lipu suli.

---

## sona ante

sona mute li lon lipu [`docs/README.md`](./docs/README.md): mani, toki, jan ike, jan lawa, kulupu ilo, poki sona.

jan lawa pi pali ni li jan Carlos Zamboni: https://github.com/CarlosZambonii

lipu pi ken pali li [AGPL-3.0](./LICENSE). jan ale li ken lukin e lipu pali. jan ale li wile awen e ni: pali sin li open kin.
