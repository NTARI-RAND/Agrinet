> Tradução comunitária (rascunho) — Política NTARI P2-002, Transmissão Multilíngue Global. Fonte: README.md (original em inglês, snapshot de 2026-07-29). Rascunho comunitário assistido por máquina, pendente de revisão por mantenedor regional conforme P2-002 §3.1. As especificações técnicas centrais permanecem em inglês conforme §2.2.
>
> Notou algum erro nesta tradução? Correções de tradução são contribuições
> valiosas e muito bem-vindas: faça um fork do repositório e abra um pull
> request em https://github.com/NTARI-RAND/Agrinet.

# Frontend

Este diretório hospeda as interfaces web do Fruitful.

## Sub-aplicações

- `app/` – Site em Next.js que fornece a interface principal do usuário.
- `chat-ui/` – Interface conversacional construída com Vite e React. Consulte [chat-ui/ARCHITECTURE.md](chat-ui/ARCHITECTURE.md) para detalhes de arquitetura.

## Variáveis de ambiente

Ambas as sub-aplicações dependem de variáveis de ambiente para se comunicar com os serviços de backend.

### Next.js (`app/`)

- `NEXT_PUBLIC_BACKEND_URL` – URL base para as requisições à API do backend.
- `NEXT_PUBLIC_API_KEY` – Chave de API usada para autorizar as requisições do site Next.js.
- `NEXT_PUBLIC_APPSYNC_GRAPHQL_ENDPOINT` – URL do endpoint GraphQL do AppSync.
- `NEXT_PUBLIC_APPSYNC_API_KEY` – Chave de API para as requisições ao AppSync.

### Chat UI (`chat-ui/`)

- `VITE_API_BASE_URL` – URL base da API usada pela interface de chat.
- `VITE_API_KEY` – Chave de API usada pela interface de chat.
