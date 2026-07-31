> Traducción comunitaria (borrador) — Política P2-002 de NTARI, Difusión Global Multilingüe. Fuente: README.md (original en portugués, captura del 2026-07-29). Borrador comunitario asistido por máquina, pendiente de revisión por un mantenedor regional según P2-002 §3.1. Las especificaciones técnicas centrales permanecen en inglés según §2.2.
>
> ¿Encontraste un error en esta traducción? Tu corrección es una contribución
> bienvenida y valorada: haz un fork del repositorio y abre un pull request en
> https://github.com/NTARI-RAND/Agrinet.

# Agrinet — Marketplace Agrícola Descentralizado

Plataforma open source de comercio agrícola para Brasil. Conecta a productores, compradores y prestadores de servicios en un marketplace seguro con pagos en escrow, chat en tiempo real, antifraude y sincronización federada entre nodos.

> Derivado del proyecto original [NTARI-RAND/Agrinet](https://github.com/NTARI-RAND/Agrinet) — adaptado para el mercado brasileño por [Carlos Zamboni](https://github.com/CarlosZambonii).

**Deploy activo:** [https://agrinet.duckdns.org](https://agrinet.duckdns.org)

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + Shadcn/ui + Framer Motion |
| Backend | Node.js + Express |
| Base de datos | MariaDB |
| Caché y colas | Redis + BullMQ |
| Pagos | Stripe (PaymentIntent + escrow) |
| Subida de imágenes | Cloudflare R2 |
| Tiempo real | Socket.IO |
| Observabilidad | Prometheus + Grafana |
| Autenticación | JWT + bcryptjs |
| Reverse proxy | nginx (HTTPS, enrutamiento, WebSocket) |
| SSL | Let's Encrypt vía Certbot |
| Infraestructura | Docker + Docker Compose |
| CI/CD | GitHub Actions → Docker Hub → VPS |

---

## Funcionalidades

- **Marketplace** — anuncios de granos, frutas, ganado, maquinaria y más, con filtros, búsqueda y ordenamiento
- **Pagos con escrow** — Stripe PaymentIntent, liberación por parte del vendedor, reembolso automático
- **Wallet** — saldo, historial de créditos/débitos, ledger contable con auditoría
- **Chat en tiempo real** — Socket.IO con fallback de polling, indicador de escritura, notificaciones
- **Antifraude** — velocity check, fraud score, niveles de confianza (trust levels), cola de moderación
- **Federación** — sincronización de anuncios y bloqueos entre los nodos de la red
- **Panel de Administración** — estadísticas, moderación de listings, disputas, audit log
- **Subida de imágenes** — drag-and-drop, almacenamiento en Cloudflare R2
- **Observabilidad** — métricas de Prometheus, dashboards de Grafana, alertas configuradas

---

## Ejecutar con Docker (recomendado)

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

| Servicio | URL local |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:5000 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

Para levantar también el monitoreo:
```bash
docker compose --profile monitoring up -d
```

### Deploy en VPS con HTTPS

El stack de producción usa nginx como reverse proxy con SSL vía Let's Encrypt. Consulta [`docs/infra.md`](./docs/infra.md) para el paso a paso completo.

---

## Ejecutar localmente (desarrollo)

**Requisitos previos:** Node.js 20+, MariaDB, Redis

```bash
# Backend
cd backend
cp .env.example .env        # preencher variáveis
npm install
mariadb -u root -p < ../schema.sql
node server.js              # sobe em http://localhost:5000

# Frontend (outro terminal)
cd frontend
npm install
# criar frontend/.env.local:
# NEXT_PUBLIC_API_URL=http://localhost:5000
# NEXT_PUBLIC_API_KEY=<valor do API_KEY no .env>
npm run dev                 # sobe em http://localhost:3000
```

---

## Variables de Entorno

Todas están documentadas en [`backend/.env.example`](./backend/.env.example). Las esenciales:

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | Clave secreta para los tokens JWT |
| `API_KEY` | Clave de acceso de la API (header `X-API-Key`) |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook de Stripe |
| `R2_ACCOUNT_ID` | ID de la cuenta de Cloudflare |
| `R2_ACCESS_KEY_ID` | Access Key del bucket R2 |
| `R2_SECRET_ACCESS_KEY` | Secret Key del bucket R2 |
| `R2_PUBLIC_URL` | URL pública del bucket (ej.: `https://pub-xxx.r2.dev`) |

---

## CI/CD

El pipeline se compone de dos workflows encadenados:

**1. `build-and-push.yml`** — Se dispara con cada push a `main` que incluya cambios en `backend/`, `frontend/` o `infra/`. Construye y publica las tres imágenes en Docker Hub:

- `caza6367/agrinet-api:latest`
- `caza6367/agrinet-frontend:latest`
- `caza6367/agrinet-federation-sync:latest`

**2. `deploy.yml`** — Se dispara automáticamente al finalizar el workflow de build. Accede a la VPS vía SSH y ejecuta `docker compose pull && up -d`.

**Secrets requeridos en el repositorio** (`Settings → Secrets → Actions`):

| Secret | Descripción |
|---|---|
| `DOCKERHUB_USERNAME` | Usuario de Docker Hub |
| `DOCKERHUB_TOKEN` | Token de acceso de Docker Hub |
| `NEXT_PUBLIC_API_URL` | URL pública de la API (ej.: `https://agrinet.duckdns.org`) |
| `NEXT_PUBLIC_API_KEY` | Clave de la API para el frontend |
| `JWT_SECRET` | Secreto JWT (generado con `openssl rand -hex 32`) |
| `API_KEY` | Clave de acceso de la API (generada con `openssl rand -hex 32`) |
| `DB_PASSWORD` | Contraseña de MariaDB |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook de Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Clave pública de Stripe |
| `R2_ACCOUNT_ID` | ID de la cuenta de Cloudflare |
| `R2_ACCESS_KEY_ID` | Access Key del bucket R2 |
| `R2_SECRET_ACCESS_KEY` | Secret Key del bucket R2 |
| `R2_PUBLIC_URL` | URL pública del bucket R2 |
| `ALLOWED_ORIGINS` | Orígenes permitidos en CORS (ej.: `https://agrinet.duckdns.org`) |
| `VPS_HOST` | IP o hostname de la VPS |
| `VPS_USER` | Usuario SSH de la VPS |
| `VPS_SSH_KEY` | Clave privada SSH para el acceso a la VPS |

---

## Estructura del Proyecto

```
Agrinet-Brazil/
├── backend/                 # API Express + workers
│   ├── routes/              # Rotas HTTP (auth, listings, wallet, chat...)
│   ├── middleware/          # Auth JWT, rate limit, upload
│   ├── lib/                 # DB pool, Redis, métricas, R2 storage
│   ├── migrations/          # Knex migrations
│   ├── workers/             # Job workers (BullMQ)
│   ├── jobs/                # Jobs agendados (expiração de pagamentos)
│   └── Dockerfile
├── frontend/                # Next.js 14 App Router
│   ├── app/                 # Páginas: /, /marketplace, /chat, /perfil, /admin
│   ├── components/          # ListingCard, NewListingModal, Nav, etc.
│   ├── lib/                 # api.js, notifications.js, hooks
│   └── Dockerfile
├── infra/
│   ├── docker/              # docker-compose.yml
│   └── backups/             # Scripts de backup automático do DB
├── monitoring/              # prometheus.yml, alerts.yml, Grafana dashboards
├── docs/                    # Documentação técnica detalhada
├── schema.sql               # Schema completo do banco de dados
└── .github/workflows/       # GitHub Actions CI/CD
```

---

## Pruebas

```bash
cd backend
npm test          # 24 testes unitários (Jest)
```

Suites cubiertas: sanitización de input, JWT, authMiddleware, fraudService.

---

## Documentación Técnica

Documentación completa en [`docs/`](./docs/README.md):

| Documento | Contenido |
|---|---|
| [auth.md](./docs/auth.md) | JWT, registro, login, RBAC, niveles de confianza (trust levels) |
| [listings.md](./docs/listings.md) | Anuncios, búsqueda, filtros, imágenes, estadísticas |
| [transactions.md](./docs/transactions.md) | Escrow, webhooks de Stripe, disputas, rating |
| [wallet.md](./docs/wallet.md) | Saldo, ledger contable, auditoría financiera |
| [chat.md](./docs/chat.md) | Mensajes, Socket.IO, notificaciones |
| [fraud.md](./docs/fraud.md) | Velocity check, fraud score, moderación |
| [admin.md](./docs/admin.md) | Panel de administración, audit log, disputas |
| [federation.md](./docs/federation.md) | Sincronización entre los nodos de la red |
| [observability.md](./docs/observability.md) | Prometheus, Grafana, alertas |
| [schema.md](./docs/schema.md) | Modelado completo de la base de datos |
| [testing.md](./docs/testing.md) | Cómo probar, escenarios validados |
| [decisions.md](./docs/decisions.md) | Decisiones arquitectónicas y contexto |

---

## Maintainer

**Carlos Zamboni**
- GitHub: [github.com/CarlosZambonii](https://github.com/CarlosZambonii)
- LinkedIn: [linkedin.com/in/carloszambonii](https://www.linkedin.com/in/carloszambonii/)

---

## Licencia

[AGPL-3.0](./LICENSE) — Código abierto, y debe permanecer así.
