# lipu README pi ilo insa Fruitful (nasin Agrinet)

> **toki lili:** lipu ni li lipu lili pi toki pona tawa kulupu, tan lawa P2-002 pi kulupu NTARI. lipu suli li lipu "README.md" pi toki Inli (tenpo: 2026-07-29). ilo li pali e lipu ni; kulupu li ken lukin e ona kin, tan lawa P2-002 kipisi 3.1.
>
> **English:** This is a condensed community rendering under NTARI policy P2-002. The complete document is the English original README.md (snapshot 2026-07-29). Machine-assisted draft pending community review per P2-002 section 3.1.
>
> sina lukin e pakala lon toki ni la o pona e ona: o pali e "fork" lon
> https://github.com/NTARI-RAND/Agrinet, o pana e "pull request". pana sina li
> pona tawa mi mute.

## ni li seme?

ilo insa ni li pana e wawa tawa nasin Agrinet. ona li awen e sona, li pana e toki lon tenpo ni tawa jan pi ma esun — jan pi pali kasi, jan esun, jan pali pi kulupu NTARI.

- ilo pali: "Node.js" e "Express"
- poki sona: "MariaDB" anu "MySQL", lon ma sina taso ("local-first")
- toki pi tenpo ni: nasin "SSE" lon `/events` e `/stream/:conversationId`
- lupa pi ken: "JWT". lupa ante li kepeken "API Key".
- linja pali: "BullMQ" tawa toki SMS e pali pi tenpo suli
- lipu jan: ona li awen lon `backend/uploads`, li kama lon `/uploads`

## nasin open

```bash
cd backend
npm install
node server.js
```

kepeken "Docker": `docker compose up --build`. ilo li pali lon lupa nanpa 5000.

## sona len (`.env`)

- `JWT_SECRET`
- `TWILIO_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (tawa SMS)
- `STRIPE_KEY` (tawa mani)
- `REDIS_HOST=redis`, `REDIS_PORT=6379` (tawa ilo "Redis" pi linja pali)

## nasin toki

- `/health` — o lukin e pona pi ilo
- `/conversations` e `/messages/:conversationId` — o lukin, o pali, o pana e toki (e lipu kin)
- `/stream/:conversationId` — toki li kama lon tenpo ni: `token`, `message`
- `/api/marketplace`, `/users`, `/federation` — ma esun, jan, wan pi ma mute
- `/api/marketplace/transactions` — esun: mani awen, sona pi pona, kalama

## awen pona

- "CORS": `https://www.ntari.org` taso li ken.
- "JWT" li awen e nasin mute. tawa "SSE", ilo li wile e "API Key" lon `x-api-key`.

## o pali kepeken mi!

open pi ilo li lon `backend/server.js`. nasin ante li lon `models/`, `routes/`, `repositories/`, `utils/`, `bull/`. o awen e lili pi `server.js`: o pana e nasin sin lon poki pi ona sama. nasin pi pali lukin li lon `backend/package.json`.
