# Agrinet — Place de marché agricole décentralisée

> Traduction communautaire (brouillon) — politique NTARI P2-002, Diffusion multilingue mondiale. Source : README.md (original en portugais, instantané du 29 juillet 2026). Brouillon communautaire assisté par machine, en attente de relecture par le mainteneur régional conformément à P2-002 §3.1. Les spécifications techniques de base restent en anglais conformément au §2.2.
>
> Vous avez remarqué une erreur de traduction ? N'hésitez pas à la corriger
> vous-même : forkez le dépôt https://github.com/NTARI-RAND/Agrinet et ouvrez
> une pull request. Les corrections de traduction sont des contributions
> précieuses, tout autant que le code.

Plateforme open source de commerce agricole pour le Brésil. Elle met en relation producteurs, acheteurs et prestataires de services au sein d'une place de marché sécurisée, avec paiements sous séquestre (escrow), chat en temps réel, dispositif antifraude et synchronisation fédérée entre nœuds.

> Dérivé du projet d'origine [NTARI-RAND/Agrinet](https://github.com/NTARI-RAND/Agrinet) — adapté au marché brésilien par [Carlos Zamboni](https://github.com/CarlosZambonii).

**Déploiement actif :** [https://agrinet.duckdns.org](https://agrinet.duckdns.org)

---

## Stack

| Couche | Technologie |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + Shadcn/ui + Framer Motion |
| Backend | Node.js + Express |
| Base de données | MariaDB |
| Cache et files d'attente | Redis + BullMQ |
| Paiements | Stripe (PaymentIntent + séquestre) |
| Upload d'images | Cloudflare R2 |
| Temps réel | Socket.IO |
| Observabilité | Prometheus + Grafana |
| Authentification | JWT + bcryptjs |
| Reverse proxy | nginx (HTTPS, routage, WebSocket) |
| SSL | Let's Encrypt via Certbot |
| Infrastructure | Docker + Docker Compose |
| CI/CD | GitHub Actions → Docker Hub → VPS |

---

## Fonctionnalités

- **Place de marché** — annonces de céréales, fruits, bétail, machines et autres, avec filtres, recherche et tri
- **Paiements sous séquestre** — Stripe PaymentIntent, libération par le vendeur, remboursement automatique
- **Portefeuille** — solde, historique des crédits/débits, grand livre comptable avec audit
- **Chat en temps réel** — Socket.IO avec repli sur le polling, indicateur de saisie, notifications
- **Antifraude** — velocity check, score de fraude, niveaux de confiance, file de modération
- **Fédération** — synchronisation des annonces et des blocages entre nœuds du réseau
- **Panneau d'administration** — statistiques, modération des annonces, litiges, journal d'audit
- **Upload d'images** — glisser-déposer, stockage sur Cloudflare R2
- **Observabilité** — métriques Prometheus, tableaux de bord Grafana, alertes configurées

---

## Lancer avec Docker (recommandé)

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

| Service | URL locale |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:5000 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

Pour démarrer également la supervision :
```bash
docker compose --profile monitoring up -d
```

### Déploiement sur VPS avec HTTPS

La stack de production utilise nginx comme reverse proxy, avec SSL via Let's Encrypt. Consultez [`docs/infra.md`](./docs/infra.md) pour la procédure pas à pas complète.

---

## Lancer en local (développement)

**Prérequis :** Node.js 20+, MariaDB, Redis

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

## Variables d'environnement

Toutes sont documentées dans [`backend/.env.example`](./backend/.env.example). Les principales :

| Variable | Description |
|---|---|
| `JWT_SECRET` | Clé secrète pour les tokens JWT |
| `API_KEY` | Clé d'accès à l'API (en-tête `X-API-Key`) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe |
| `R2_ACCOUNT_ID` | Identifiant du compte Cloudflare |
| `R2_ACCESS_KEY_ID` | Access Key du bucket R2 |
| `R2_SECRET_ACCESS_KEY` | Secret Key du bucket R2 |
| `R2_PUBLIC_URL` | URL publique du bucket (ex. : `https://pub-xxx.r2.dev`) |

---

## CI/CD

Le pipeline est composé de deux workflows enchaînés :

**1. `build-and-push.yml`** — Déclenché à chaque push sur `main` comportant des modifications dans `backend/`, `frontend/` ou `infra/`. Construit et publie les trois images sur Docker Hub :

- `caza6367/agrinet-api:latest`
- `caza6367/agrinet-frontend:latest`
- `caza6367/agrinet-federation-sync:latest`

**2. `deploy.yml`** — Déclenché automatiquement à la fin du workflow de build. Se connecte au VPS en SSH et exécute `docker compose pull && up -d`.

**Secrets requis dans le dépôt** (`Settings → Secrets → Actions`) :

| Secret | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Utilisateur Docker Hub |
| `DOCKERHUB_TOKEN` | Token d'accès Docker Hub |
| `NEXT_PUBLIC_API_URL` | URL publique de l'API (ex. : `https://agrinet.duckdns.org`) |
| `NEXT_PUBLIC_API_KEY` | Clé d'API pour le frontend |
| `JWT_SECRET` | Secret JWT (généré avec `openssl rand -hex 32`) |
| `API_KEY` | Clé d'accès à l'API (générée avec `openssl rand -hex 32`) |
| `DB_PASSWORD` | Mot de passe MariaDB |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe |
| `R2_ACCOUNT_ID` | Identifiant du compte Cloudflare |
| `R2_ACCESS_KEY_ID` | Access Key du bucket R2 |
| `R2_SECRET_ACCESS_KEY` | Secret Key du bucket R2 |
| `R2_PUBLIC_URL` | URL publique du bucket R2 |
| `ALLOWED_ORIGINS` | Origines autorisées pour le CORS (ex. : `https://agrinet.duckdns.org`) |
| `VPS_HOST` | IP ou nom d'hôte du VPS |
| `VPS_USER` | Utilisateur SSH du VPS |
| `VPS_SSH_KEY` | Clé privée SSH pour l'accès au VPS |

---

## Structure du projet

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

## Tests

```bash
cd backend
npm test          # 24 testes unitários (Jest)
```

Suites couvertes : assainissement des entrées, JWT, authMiddleware, fraudService.

---

## Documentation technique

Documentation complète dans [`docs/`](./docs/README.md) :

| Document | Contenu |
|---|---|
| [auth.md](./docs/auth.md) | JWT, inscription, connexion, RBAC, niveaux de confiance |
| [listings.md](./docs/listings.md) | Annonces, recherche, filtres, images, statistiques |
| [transactions.md](./docs/transactions.md) | Séquestre, webhooks Stripe, litiges, notation |
| [wallet.md](./docs/wallet.md) | Solde, grand livre comptable, audit financier |
| [chat.md](./docs/chat.md) | Messages, Socket.IO, notifications |
| [fraud.md](./docs/fraud.md) | Velocity check, score de fraude, modération |
| [admin.md](./docs/admin.md) | Panneau d'administration, journal d'audit, litiges |
| [federation.md](./docs/federation.md) | Synchronisation entre nœuds du réseau |
| [observability.md](./docs/observability.md) | Prometheus, Grafana, alertes |
| [schema.md](./docs/schema.md) | Modélisation complète de la base de données |
| [testing.md](./docs/testing.md) | Comment tester, scénarios validés |
| [decisions.md](./docs/decisions.md) | Décisions architecturales et contexte |

---

## Mainteneur

**Carlos Zamboni**
- GitHub : [github.com/CarlosZambonii](https://github.com/CarlosZambonii)
- LinkedIn : [linkedin.com/in/carloszambonii](https://www.linkedin.com/in/carloszambonii/)

---

## Licence

[AGPL-3.0](./LICENSE) — Open source, et cela doit rester ainsi.
