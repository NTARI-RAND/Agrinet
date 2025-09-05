# Frontend

This directory hosts the web interfaces for Fruitful.

## Sub-apps

- `app/` – Next.js site providing the main user interface.
- `chat-ui/` – Conversational interface built with Vite and React. See [chat-ui/ARCHITECTURE.md](chat-ui/ARCHITECTURE.md) for architectural details.

## Environment variables

Both sub-apps rely on environment variables to communicate with backend services.

### Next.js (`app/`)

- `NEXT_PUBLIC_BACKEND_URL` – Base URL for backend API requests.
- `NEXT_PUBLIC_API_KEY` – API key used to authorize requests from the Next.js site.

### Chat UI (`chat-ui/`)

- `VITE_API_BASE_URL` – Base URL for the API used by the chat interface.
- `VITE_API_KEY` – API key used by the chat interface.

