# Fruitful Backend (Agrinet Platform)

This backend powers Agrinet services using Node.js, Express, AWS DynamoDB, and Server‑Sent Events (SSE) for streaming chat updates.

## Overview

- Runtime: Node.js + Express
- Data: AWS DynamoDB (DocumentClient)
- Streaming: SSE (`/events`, `/stream/:conversationId`)
- Auth: JWT middleware; API Key support for some endpoints
- Queues: BullMQ for SMS and background jobs
- Uploads: Files stored under `backend/uploads` served at `/uploads`

## Quickstart

```bash
cd backend
npm install
node server.js
```

Docker-based local dev with DynamoDB Local:
```bash
docker compose up --build
```

The API typically runs on port 5000 (see docker-compose).

## Environment

Required (or set via `.env`):
- AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, DYNAMODB_ENDPOINT (for local)
- JWT_SECRET
- TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (for SMS; optional TWILIO_STATUS_CALLBACK_URL)
- STRIPE_KEY (if deposits enabled)

## Redis Configuration

To run Redis, ensure it’s included in your `docker-compose.yml` file:

```yml
redis:
  image: redis:latest
  command: redis-server
  ports:
    - "6379:6379"
  networks:
    - backend
```

Set the following environment variables in `.env`:
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`

These settings allow the backend services to connect to Redis for queue management and other tasks.

## Routing

Main mounts (see `server.js`):
- `/health` – health check
- `/uploads/*` – static uploads
- `/events` – SSE broadcast channel
- `/stream/:conversationId` – SSE per‑conversation stream

Domain routes (when not in minimal mode):
- `/` → `routes/api.js` (composed transaction + notification)
- `/api/auth` → auth routes
- `/api/keys` → key management
- `/api/contracts` → contracts
- `/api/admin` → admin
- `/api/marketplace` → marketplace
- `/users` → user management
- `/products` → products
- `/broadcast` → broadcasts
- `/sms` → SMS webhooks
- `/cart`, `/orders`, `/subscriptions`
- `/conversations`, `/messages`
- `/inventory`, `/api/location`
- `/federation`, `/trends`
- `/deposit` (optional; guarded by auth)

## Data Model (DynamoDB tables)

- `Users`, `Keys`
- `Listings`, `Contracts`, `Transactions`
- `Conversations`, `Messages`
- `Notifications`
- `Inventory`
- `AgriculturalData` (for price/info lookups)

Each model file exports a `*_TABLE_NAME` and an item builder, e.g.:
- `models/user.js` → `USER_TABLE_NAME`, `createUserItem()`
- `models/transaction.js` → `TRANSACTION_TABLE_NAME`, `createTransactionItem()`

## Chat & Streaming

Endpoints (used by the Chat UI):
- `GET /conversations` → list
- `POST /conversations` → create
- `PUT /conversations/:id` → rename
- `POST /conversations/:id/pin` → toggle pin
- `DELETE /conversations/:id` → delete
- `GET /messages/:conversationId` → list messages
- `POST /messages/:conversationId` → send message (optionally with file)
- `GET /stream/:conversationId` (SSE) → events:
  - `token`: `{ id, token }`
  - `message`: `{ message }`

Server emitters (global):
- `emitToken(conversationId, id, token)`
- `emitMessage(conversationId, message)`

## Transactions & Notifications

- `POST /api/transactions`:
  - Writes item to `Transactions`
  - Writes `Notifications` item for buyer
  - Enqueues a “ping” job
  - May broadcast SSE events

## Security & Auth

- CORS: restricted to `https://www.ntari.org`
- JWT: middleware enforces authorization on protected routes
- API Key for SSE: the Chat UI passes an API key as `x-api-key` query parameter for SSE requests; the server accepts `x-api-key` (and also `api_key` for backward compatibility) on `/events` and `[...]`

## Jobs & SMS

- `bull/smsQueue.js`: BullMQ worker that sends SMS via Twilio
- `routes/smsRoutes.js`: webhooks for incoming/status
- Background workers in Docker Compose:
  - `federation-sync`, `key-expiry-cleaner`

## Useful Paths

- Entry: `backend/server.js`
- Models: `backend/models/*`
- Routes: `backend/routes/*`
- Utils: `backend/utils/*`
- Queues: `backend/bull/*`
- Uploads: `backend/uploads`

## Testing

See `backend/package.json` for Jest config and tests. Add route/model tests under `__tests__/`.

---
Contributions welcome! Please keep `server.js` slim by adding routes and logic in domain folders.
