> Traducción comunitaria (borrador) — Política P2-002 de NTARI, Difusión Global Multilingüe. Fuente: README.md (original en inglés, instantánea del 2026-07-29). Borrador comunitario asistido por máquina, pendiente de revisión por el mantenedor regional según P2-002 §3.1. Las especificaciones técnicas centrales permanecen en inglés según §2.2.
>
> ¿Encontraste un error en esta traducción? Tu corrección es una contribución
> bienvenida y valorada: haz un fork del repositorio y abre un pull request en
> https://github.com/NTARI-RAND/Agrinet.

# Frontend

Este directorio aloja las interfaces web de Fruitful.

## Subaplicaciones

- `app/` – Sitio en Next.js que provee la interfaz de usuario principal.
- `chat-ui/` – Interfaz conversacional construida con Vite y React. Consulta [chat-ui/ARCHITECTURE.md](chat-ui/ARCHITECTURE.md) para los detalles de arquitectura.

## Variables de entorno

Ambas subaplicaciones dependen de variables de entorno para comunicarse con los servicios de backend.

### Next.js (`app/`)

- `NEXT_PUBLIC_BACKEND_URL` – URL base para las solicitudes a la API del backend.
- `NEXT_PUBLIC_API_KEY` – Clave de API utilizada para autorizar las solicitudes desde el sitio en Next.js.
- `NEXT_PUBLIC_APPSYNC_GRAPHQL_ENDPOINT` – URL del endpoint GraphQL de AppSync.
- `NEXT_PUBLIC_APPSYNC_API_KEY` – Clave de API para las solicitudes a AppSync.

### Chat UI (`chat-ui/`)

- `VITE_API_BASE_URL` – URL base de la API utilizada por la interfaz de chat.
- `VITE_API_KEY` – Clave de API utilizada por la interfaz de chat.
