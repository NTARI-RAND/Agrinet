> Traduction communautaire (version préliminaire) — politique NTARI P2-002, Diffusion multilingue mondiale. Source : README.md (original portugais, instantané du 2026-07-29). Version préliminaire communautaire assistée par machine, en attente de relecture par le mainteneur régional conformément à P2-002 §3.1. Les spécifications techniques de référence restent en anglais conformément au §2.2.
>
> Vous avez remarqué une erreur de traduction ? N'hésitez pas à la corriger
> vous-même : forkez le dépôt https://github.com/NTARI-RAND/Agrinet et ouvrez
> une pull request. Les corrections de traduction sont des contributions
> précieuses, tout autant que le code.

# Agrinet — Documentation technique

Place de marché agricole décentralisée pour le Brésil. Couvre le cycle complet d'une négociation : publication de l'annonce, paiement avec séquestre (escrow), libération des fonds au vendeur, chat en temps réel, antifraude et fédération entre nœuds.

**Frontend :** Next.js 14 + Tailwind + Shadcn/ui + Framer Motion  
**Backend :** Node.js + Express + MariaDB + Redis  
**Infra :** Docker Compose + GitHub Actions CI/CD + Cloudflare R2

---

## Pipeline commercial principal

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

---

## Stack

| Couche | Technologie |
|---|---|
| Backend HTTP | Node.js + Express |
| Base de données | MariaDB |
| Paiements | Stripe PaymentIntent API |
| Authentification | JWT + bcryptjs |
| Temps réel | Socket.IO |
| Cache et files d'attente | Redis + BullMQ |
| Observabilité | Prometheus + Grafana |
| Upload de fichiers | Multer |

---

## Architecture en couches

```
Requisicao HTTP
        |
        v
     Route (Express)
        |
        v
Middleware (Auth / Rate Limit / Sanitizacao)
        |
        v
   Service (Regra de Negocio)
        |
        v
 Repository (Acesso ao Banco)
        |
        v
      MariaDB
```

---

## Index de la documentation

| Document | Contenu |
|---|---|
| [auth.md](./auth.md) | JWT, inscription, connexion, RBAC, niveaux de confiance, déblocage automatique |
| [listings.md](./listings.md) | Annonces, recherche, géolocalisation, images, statistiques, historique des prix |
| [transactions.md](./transactions.md) | Transactions, notation, escrow, webhooks Stripe, idempotence, litiges |
| [wallet.md](./wallet.md) | Wallet, registre comptable (ledger), débit/crédit atomique, audit financier |
| [chat.md](./chat.md) | Conversations, messages, statut de livraison, pagination, pièces jointes, WebSocket, notifications |
| [fraud.md](./fraud.md) | Velocity des dépôts et des échecs, fraud score, niveaux de confiance, fraud queue, modération |
| [admin.md](./admin.md) | Dashboard, utilisateurs, listings, litiges, finances, fraud queue, audit log |
| [federation.md](./federation.md) | Export, import, sync job, blocage inter-nœuds |
| [observability.md](./observability.md) | Métriques Prometheus par catégorie, Grafana, alertes |
| [infra.md](./infra.md) | Rate limiting, Redis, BullMQ, sanitisation, variables d'environnement |
| [broadcast.md](./broadcast.md) | Système de broadcast interne entre composants |
| [schema.md](./schema.md) | Modélisation complète de la base de données, champs, contraintes, relations |
| [decisions.md](./decisions.md) | Décisions architecturales : migration DynamoDB, atomicité, JWT, fédération |
| [testing.md](./testing.md) | Scripts de test, scénarios validés, comment les exécuter |

---

## État des modules

| Module | Statut |
|---|---|
| Authentification JWT + RBAC | Terminé |
| Listings avec images, statistiques et historique des prix | Terminé |
| Recherche avec filtres et géolocalisation | Terminé |
| Transactions avec escrow | Terminé |
| Système de notation bilatérale | Terminé |
| Paiements Stripe (create, webhook, refund) | Terminé |
| Wallet avec registre comptable et audit | Terminé |
| Litiges et résolution administrative | Terminé |
| Chat avec statut de livraison, pagination et pièces jointes | Terminé |
| Notifications hors ligne et WebSocket | Terminé |
| Antifraude (velocity, scoring, niveaux de confiance) | Terminé |
| Modération des listings | Terminé |
| Panneau d'administration complet | Terminé |
| Audit log des actions administratives | Terminé |
| Fédération entre nœuds | Terminé |
| Redis + BullMQ | Terminé |
| Prometheus + Grafana | Terminé |
| Rate limiting par IP et par utilisateur | Terminé |
| Sanitisation et validation des entrées | Terminé |
| Audit financier append-only | Terminé |
| Object Storage — Cloudflare R2 | Terminé |
| Frontend Next.js 14 | Terminé |
| CI/CD GitHub Actions | Terminé |
| Intégration PIX | Planifié |
| Listings agricoles complets (certifications, traçabilité) | Planifié |

---

## Prochaines phases

**Phase 4 — PIX**
Intégration de PIX via Stripe pour une utilisation réelle sur le marché brésilien. Nécessite une table dédiée et un webhook sécurisé pour les événements PIX.

**Phase 5 — Listings agricoles complets**
Attributs spécifiques par catégorie, certifications, traçabilité de l'origine et catalogue agricole détaillé.

**Phase 6 — Frontend** ✅ Terminé
Next.js 14 avec marketplace, chat, profil, administration et système de design agro complet.

**Phase 7 — Infrastructure de production** ✅ Terminé
Docker Compose, CI/CD avec GitHub Actions, images sur Docker Hub, sauvegardes automatiques, Cloudflare R2 pour les uploads.

**Phase 8 — Domaine et déploiement**
Faire pointer le domaine vers le serveur, configurer HTTPS (nginx/Caddy), mettre à jour `NEXT_PUBLIC_API_URL` dans la CI.

**Phase 9 — PIX**
Intégration de PIX via Stripe pour une utilisation réelle sur le marché brésilien.
