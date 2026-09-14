> Traducción comunitaria (borrador) — Política P2-002 de NTARI, Difusión Multilingüe Global. Fuente: README.md (original en inglés, captura del 2026-07-29). Borrador comunitario asistido por máquina, pendiente de revisión por el mantenedor regional conforme a P2-002 §3.1. Las especificaciones técnicas centrales permanecen en inglés conforme a §2.2.
>
> ¿Encontraste un error en esta traducción? Tu corrección es una contribución
> bienvenida y valorada: haz un fork del repositorio y abre un pull request en
> https://github.com/NTARI-RAND/Agrinet.

# Backend de Fruitful (Plataforma Agrinet)

Este backend impulsa los servicios de Agrinet utilizando Node.js, Express y Server-Sent Events (SSE) para la transmisión en streaming de actualizaciones del chat.

## Descripción general

- Runtime: Node.js + Express
- Base de datos: MariaDB / MySQL (arquitectura local-first)
- Streaming: SSE (`/events`, `/stream/:conversationId`)
- Autenticación: middleware JWT; soporte de API Key para algunos endpoints
- Colas: BullMQ para SMS y trabajos en segundo plano
- Cargas de archivos: los archivos se almacenan en `backend/uploads` y se sirven en `/uploads`

## Inicio rápido

```bash
cd backend
npm install
node server.js
```

Desarrollo local basado en Docker:
```bash
docker compose up --build
```

La API normalmente se ejecuta en el puerto 5000 (ver docker-compose).

## Entorno

Variables requeridas (o configuradas vía `.env`):
- JWT_SECRET
- TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (para SMS; opcional TWILIO_STATUS_CALLBACK_URL)
- STRIPE_KEY (si los depósitos están habilitados)

## Configuración de Redis

Para ejecutar Redis, asegúrate de que esté incluido en tu archivo `docker-compose.yml`:

```yml
redis:
  image: redis:latest
  command: redis-server
  ports:
    - "6379:6379"
  networks:
    - backend
```

Configura las siguientes variables de entorno en `.env`:
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`

Estos ajustes permiten que los servicios del backend se conecten a Redis para la gestión de colas y otras tareas.

## Enrutamiento

Montajes principales (ver `server.js`):
- `/health` – verificación de estado (health check)
- `/uploads/*` – archivos estáticos cargados
- `/events` – canal de difusión SSE
- `/stream/:conversationId` – stream SSE por conversación

Rutas de dominio (cuando no está en modo mínimo):
- `/api/marketplace` → marketplace
- `/users` → gestión de usuarios
- `/federation` → sincronización de federación

## Chat y Streaming

Endpoints (utilizados por la interfaz de Chat):
- `GET /conversations` → listar
- `POST /conversations` → crear
- `PUT /conversations/:id` → renombrar
- `POST /conversations/:id/pin` → alternar fijado
- `DELETE /conversations/:id` → eliminar
- `GET /messages/:conversationId` → listar mensajes
- `POST /messages/:conversationId` → enviar mensaje (opcionalmente con archivo)
- `GET /stream/:conversationId` (SSE) → eventos:
  - `token`: `{ id, token }`
  - `message`: `{ message }`

Emisores del servidor (globales):
- `emitToken(conversationId, id, token)`
- `emitMessage(conversationId, message)`

## Transacciones y Notificaciones

- `POST /api/marketplace/transactions`
- `POST /api/marketplace/transactions/release-escrow`
- `POST /api/marketplace/transactions/rate`
- `POST /api/marketplace/transactions/ping`

## Seguridad y Autenticación

- CORS: restringido a `https://www.ntari.org`
- JWT: el middleware aplica la autorización en las rutas protegidas
- API Key para SSE: la interfaz de Chat pasa una API key como parámetro de consulta `x-api-key` en las solicitudes SSE; el servidor acepta `x-api-key` (y también `api_key` por compatibilidad con versiones anteriores) en `/events` y `[...]`

## Trabajos y SMS

- `bull/smsQueue.js`: worker de BullMQ que envía SMS vía Twilio
- `routes/smsRoutes.js`: webhooks para mensajes entrantes y de estado
- Workers en segundo plano en Docker Compose:
  - `federation-sync`, `key-expiry-cleaner`

## Rutas útiles

- Punto de entrada: `backend/server.js`
- Modelos: `backend/models/*`
- Rutas: `backend/routes/*`
- Repositorios: `backend/repositories/*`
- Utilidades: `backend/utils/*`
- Colas: `backend/bull/*`
- Cargas de archivos: `backend/uploads`

## Pruebas

Consulta `backend/package.json` para conocer los comandos de prueba actuales.

---
¡Las contribuciones son bienvenidas! Por favor, mantén `server.js` ligero agregando las rutas y la lógica en las carpetas de dominio.
