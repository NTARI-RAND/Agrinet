> Traduction communautaire (brouillon) — politique NTARI P2-002, Diffusion multilingue mondiale. Source : README.md (original anglais, instantané du 2026-07-29). Brouillon communautaire assisté par machine, en attente de relecture par le mainteneur régional conformément à P2-002 §3.1. Les spécifications techniques de référence restent en anglais conformément au §2.2.
>
> Vous avez remarqué une erreur de traduction ? N'hésitez pas à la corriger
> vous-même : forkez le dépôt https://github.com/NTARI-RAND/Agrinet et ouvrez
> une pull request. Les corrections de traduction sont des contributions
> précieuses, tout autant que le code.

# Frontend

Ce répertoire héberge les interfaces web de Fruitful.

## Sous-applications

- `app/` – Site Next.js fournissant l'interface utilisateur principale.
- `chat-ui/` – Interface conversationnelle construite avec Vite et React. Voir [chat-ui/ARCHITECTURE.md](chat-ui/ARCHITECTURE.md) pour les détails d'architecture.

## Variables d'environnement

Les deux sous-applications s'appuient sur des variables d'environnement pour communiquer avec les services backend.

### Next.js (`app/`)

- `NEXT_PUBLIC_BACKEND_URL` – URL de base des requêtes vers l'API backend.
- `NEXT_PUBLIC_API_KEY` – Clé d'API utilisée pour autoriser les requêtes provenant du site Next.js.
- `NEXT_PUBLIC_APPSYNC_GRAPHQL_ENDPOINT` – URL du point de terminaison GraphQL AppSync.
- `NEXT_PUBLIC_APPSYNC_API_KEY` – Clé d'API pour les requêtes AppSync.

### Chat UI (`chat-ui/`)

- `VITE_API_BASE_URL` – URL de base de l'API utilisée par l'interface de chat.
- `VITE_API_KEY` – Clé d'API utilisée par l'interface de chat.

