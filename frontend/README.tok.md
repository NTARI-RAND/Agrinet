# lipu pi poki `frontend`

> **toki lili:** lipu ni li lipu lili pi toki pona, tan nasin lawa "P2-002" pi kulupu NTARI. lipu suli li lipu "README.md" pi toki Inli (tenpo suno 2026-07-29). ilo sona li pali e lipu ni. kulupu li lukin ala e ona lon tenpo ni — kulupu o lukin e ona kepeken nasin 3.1 pi lawa "P2-002".
>
> **Note (English):** This is a condensed community rendering under NTARI policy P2-002. The complete document is the English original README.md (snapshot 2026-07-29). Machine-assisted draft pending community review per P2-002 section 3.1.
>
> sina lukin e pakala lon toki ni la o pona e ona: o pali e "fork" lon
> https://github.com/NTARI-RAND/Agrinet, o pana e "pull request". pana sina li
> pona tawa mi mute.

## ni li seme?

poki `frontend` li jo e ilo lukin pi ma "web" tawa pali "Fruitful". jan li kepeken ilo ni.

## ilo tu

- `app/` — ilo lukin nanpa wan. ona li kepeken nasin "Next.js".
- `chat-ui/` — ilo pi toki: jan li toki tawa ona, ona li toki tawa jan. ona li kepeken nasin "Vite" en nasin "React". sona suli li lon lipu [chat-ui/ARCHITECTURE.md](chat-ui/ARCHITECTURE.md).

## nimi pi ma "environment"

ilo tu ni li wile e nimi "environment variable" tan ni: ona li toki tawa ilo "backend".

- `app/`: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_API_KEY`, `NEXT_PUBLIC_APPSYNC_GRAPHQL_ENDPOINT`, `NEXT_PUBLIC_APPSYNC_API_KEY`
- `chat-ui/`: `VITE_API_BASE_URL`, `VITE_API_KEY`

nimi "URL" li pana e nasin tawa ilo ante. nimi "API key" li pana e ken pali.

## sina wile pali la

lipu ni li lili. sina wile e sona ale la o lukin e lipu `README.md` pi toki Inli.
