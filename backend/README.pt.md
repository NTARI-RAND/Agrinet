> Tradução comunitária (rascunho) — Política NTARI P2-002, Transmissão Multilíngue Global. Fonte: README.md (original em inglês, snapshot de 2026-07-29). Rascunho comunitário assistido por máquina, pendente de revisão por mantenedor regional conforme P2-002 §3.1. As especificações técnicas centrais permanecem em inglês conforme §2.2.
>
> Notou algum erro nesta tradução? Correções de tradução são contribuições
> valiosas e muito bem-vindas: faça um fork do repositório e abra um pull
> request em https://github.com/NTARI-RAND/Agrinet.

# Backend Fruitful (Plataforma Agrinet)

Este backend alimenta os serviços da Agrinet usando Node.js, Express e Server-Sent Events (SSE) para streaming de atualizações de chat.

## Visão Geral

- Runtime: Node.js + Express
- Banco de dados: MariaDB / MySQL (arquitetura local-first)
- Streaming: SSE (`/events`, `/stream/:conversationId`)
- Autenticação: middleware JWT; suporte a API Key em alguns endpoints
- Filas: BullMQ para SMS e jobs em segundo plano
- Uploads: arquivos armazenados em `backend/uploads` e servidos em `/uploads`

## Início Rápido

```bash
cd backend
npm install
node server.js
```

Desenvolvimento local com Docker:
```bash
docker compose up --build
```

A API normalmente roda na porta 5000 (veja o docker-compose).

## Ambiente

Variáveis obrigatórias (ou definidas via `.env`):
- JWT_SECRET
- TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (para SMS; TWILIO_STATUS_CALLBACK_URL opcional)
- STRIPE_KEY (se os depósitos estiverem habilitados)

## Configuração do Redis

Para executar o Redis, garanta que ele esteja incluído no seu arquivo `docker-compose.yml`:

```yml
redis:
  image: redis:latest
  command: redis-server
  ports:
    - "6379:6379"
  networks:
    - backend
```

Defina as seguintes variáveis de ambiente no `.env`:
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`

Essas configurações permitem que os serviços do backend se conectem ao Redis para gerenciamento de filas e outras tarefas.

## Roteamento

Montagens principais (veja `server.js`):
- `/health` – verificação de saúde (health check)
- `/uploads/*` – uploads estáticos
- `/events` – canal de broadcast SSE
- `/stream/:conversationId` – stream SSE por conversa

Rotas de domínio (quando não estiver em modo mínimo):
- `/api/marketplace` → marketplace
- `/users` → gerenciamento de usuários
- `/federation` → sincronização de federação

## Chat e Streaming

Endpoints (usados pela interface de Chat):
- `GET /conversations` → listar
- `POST /conversations` → criar
- `PUT /conversations/:id` → renomear
- `POST /conversations/:id/pin` → alternar fixação (pin)
- `DELETE /conversations/:id` → excluir
- `GET /messages/:conversationId` → listar mensagens
- `POST /messages/:conversationId` → enviar mensagem (opcionalmente com arquivo)
- `GET /stream/:conversationId` (SSE) → eventos:
  - `token`: `{ id, token }`
  - `message`: `{ message }`

Emissores do servidor (globais):
- `emitToken(conversationId, id, token)`
- `emitMessage(conversationId, message)`

## Transações e Notificações

- `POST /api/marketplace/transactions`
- `POST /api/marketplace/transactions/release-escrow`
- `POST /api/marketplace/transactions/rate`
- `POST /api/marketplace/transactions/ping`

## Segurança e Autenticação

- CORS: restrito a `https://www.ntari.org`
- JWT: o middleware impõe autorização nas rotas protegidas
- API Key para SSE: a interface de Chat envia uma API key como parâmetro de query `x-api-key` nas requisições SSE; o servidor aceita `x-api-key` (e também `api_key` para compatibilidade retroativa) em `/events` e `[...]`

## Jobs e SMS

- `bull/smsQueue.js`: worker BullMQ que envia SMS via Twilio
- `routes/smsRoutes.js`: webhooks para mensagens recebidas e status
- Workers em segundo plano no Docker Compose:
  - `federation-sync`, `key-expiry-cleaner`

## Caminhos Úteis

- Ponto de entrada: `backend/server.js`
- Modelos: `backend/models/*`
- Rotas: `backend/routes/*`
- Repositórios: `backend/repositories/*`
- Utilitários: `backend/utils/*`
- Filas: `backend/bull/*`
- Uploads: `backend/uploads`

## Testes

Veja `backend/package.json` para os comandos de teste atuais.

---
Contribuições são bem-vindas! Por favor, mantenha o `server.js` enxuto adicionando rotas e lógica nas pastas de domínio.
