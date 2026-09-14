> Traduction communautaire (version préliminaire) — politique NTARI P2-002, Diffusion multilingue mondiale. Source : README.md (original anglais, instantané du 2026-07-29). Version préliminaire communautaire assistée par machine, en attente de relecture par un mainteneur régional conformément à P2-002 §3.1. Les spécifications techniques essentielles restent en anglais conformément au §2.2.
>
> Vous avez remarqué une erreur de traduction ? N'hésitez pas à la corriger
> vous-même : forkez le dépôt https://github.com/NTARI-RAND/Agrinet et ouvrez
> une pull request. Les corrections de traduction sont des contributions
> précieuses, tout autant que le code.

# Backend Fruitful (plateforme Agrinet)

Ce backend fait fonctionner les services Agrinet à l'aide de Node.js, d'Express et des Server-Sent Events (SSE) pour diffuser en continu les mises à jour du chat.

## Aperçu

- Environnement d'exécution : Node.js + Express
- Base de données : MariaDB / MySQL (architecture local-first)
- Streaming : SSE (`/events`, `/stream/:conversationId`)
- Authentification : middleware JWT ; prise en charge de clés d'API pour certains endpoints
- Files d'attente : BullMQ pour les SMS et les tâches en arrière-plan
- Téléversements : fichiers stockés dans `backend/uploads` et servis à l'adresse `/uploads`

## Démarrage rapide

```bash
cd backend
npm install
node server.js
```

Développement local avec Docker :
```bash
docker compose up --build
```

L'API fonctionne généralement sur le port 5000 (voir docker-compose).

## Environnement

Variables requises (ou définies via `.env`) :
- JWT_SECRET
- TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (pour les SMS ; TWILIO_STATUS_CALLBACK_URL en option)
- STRIPE_KEY (si les dépôts sont activés)

## Configuration de Redis

Pour exécuter Redis, assurez-vous qu'il est bien inclus dans votre fichier `docker-compose.yml` :

```yml
redis:
  image: redis:latest
  command: redis-server
  ports:
    - "6379:6379"
  networks:
    - backend
```

Définissez les variables d'environnement suivantes dans `.env` :
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`

Ces paramètres permettent aux services backend de se connecter à Redis pour la gestion des files d'attente et d'autres tâches.

## Routage

Points de montage principaux (voir `server.js`) :
- `/health` – vérification de l'état de santé
- `/uploads/*` – téléversements statiques
- `/events` – canal de diffusion SSE
- `/stream/:conversationId` – flux SSE par conversation

Routes de domaine (hors mode minimal) :
- `/api/marketplace` → place de marché
- `/users` → gestion des utilisateurs
- `/federation` → synchronisation de la fédération

## Chat et streaming

Endpoints (utilisés par l'interface de chat) :
- `GET /conversations` → liste
- `POST /conversations` → création
- `PUT /conversations/:id` → renommage
- `POST /conversations/:id/pin` → activer/désactiver l'épinglage
- `DELETE /conversations/:id` → suppression
- `GET /messages/:conversationId` → liste des messages
- `POST /messages/:conversationId` → envoi d'un message (avec fichier en option)
- `GET /stream/:conversationId` (SSE) → événements :
  - `token` : `{ id, token }`
  - `message` : `{ message }`

Émetteurs côté serveur (globaux) :
- `emitToken(conversationId, id, token)`
- `emitMessage(conversationId, message)`

## Transactions et notifications

- `POST /api/marketplace/transactions`
- `POST /api/marketplace/transactions/release-escrow`
- `POST /api/marketplace/transactions/rate`
- `POST /api/marketplace/transactions/ping`

## Sécurité et authentification

- CORS : restreint à `https://www.ntari.org`
- JWT : le middleware impose l'autorisation sur les routes protégées
- Clé d'API pour SSE : l'interface de chat transmet une clé d'API dans le paramètre de requête `x-api-key` pour les requêtes SSE ; le serveur accepte `x-api-key` (ainsi que `api_key` pour la rétrocompatibilité) sur `/events` et `[...]`

## Tâches et SMS

- `bull/smsQueue.js` : worker BullMQ qui envoie les SMS via Twilio
- `routes/smsRoutes.js` : webhooks pour les messages entrants et les statuts
- Workers en arrière-plan dans Docker Compose :
  - `federation-sync`, `key-expiry-cleaner`

## Chemins utiles

- Point d'entrée : `backend/server.js`
- Modèles : `backend/models/*`
- Routes : `backend/routes/*`
- Repositories : `backend/repositories/*`
- Utilitaires : `backend/utils/*`
- Files d'attente : `backend/bull/*`
- Téléversements : `backend/uploads`

## Tests

Consultez `backend/package.json` pour les commandes de test actuelles.

---
Les contributions sont bienvenues ! Merci de garder `server.js` léger en ajoutant les routes et la logique dans les dossiers de domaine.
