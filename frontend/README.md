# Frontend

This directory hosts the web interfaces for Fruitful.

## Sub-apps

- `app/` – Next.js site providing the main user interface.
- `chat-ui/` – Conversational interface built with Vite and React. See [chat-ui/ARCHITECTURE.md](chat-ui/ARCHITECTURE.md) for architectural details.

## Garden planner

Run `npm install` then `npm run dev` in this directory and open `/garden-planner`,
or follow **Garden planner** in the site navigation. This page needs no backend
server, account, API key, or external service.

Choose a bed from 1–8 feet in each dimension, set the planting date, select a crop,
then click or keyboard-activate a square. **Erase a square** clears a planting.
Counts, adjacent-crop warnings, and estimated harvest dates reuse
`backend/utils/squareFootGardening.js`. The four supported crops are tomato,
lettuce, carrot, and basil. Harvest estimates use fixed maturity intervals;
they do not account for climate, soil, variety, or the local growing season.

**Save plan** explicitly writes one plan to this browser's local storage.
**Export JSON** downloads a portable copy; **Import JSON** restores an editable
plan. Imports accept version 1 rectangular beds, supported crops, and a real
date, with a 32 KB file limit. Invalid imports leave the current bed intact.
Shrinking a bed requires confirmation if planted squares would be removed.
Browser storage can be cleared or unavailable, so export a file for a backup.
This is a local planning format, not a federated Plan protocol message.

Run `npm run test:planner` for dependency-free planner tests, `npm run lint` for
frontend lint, or `npm test` for planner tests followed by a production build.

Design context: [Agrinet's local-growing purpose (Slack, October 19, 2026)](https://ntari.slack.com/archives/C0AENHR5KG8/p1792416355639889)
and [modular planting coordination (Confluence)](https://ntari.atlassian.net/wiki/spaces/Agrinet/pages/6815770).
The current repository's `CLAUDE.md` and `CONFORMANCE.md` govern implementation;
older roadmap text does not supersede those invariants.

Screenshots: [editable bed](docs/screenshots/garden-planner.png) and
[neighbor conflicts](docs/screenshots/garden-planner-conflicts.png).

## Environment variables

Both sub-apps rely on environment variables to communicate with backend services.

### Next.js (`app/`)

- `NEXT_PUBLIC_BACKEND_URL` – Base URL for backend API requests.
- `NEXT_PUBLIC_API_KEY` – API key used to authorize requests from the Next.js site.
- `NEXT_PUBLIC_APPSYNC_GRAPHQL_ENDPOINT` – AppSync GraphQL endpoint URL.
- `NEXT_PUBLIC_APPSYNC_API_KEY` – API key for AppSync requests.

### Chat UI (`chat-ui/`)

- `VITE_API_BASE_URL` – Base URL for the API used by the chat interface.
- `VITE_API_KEY` – API key used by the chat interface.

