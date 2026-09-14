> Traducción comunitaria (borrador) — Política P2-002 de NTARI, Difusión Multilingüe Global. Fuente: README.md (original en portugués, captura del 2026-07-29). Borrador comunitario asistido por máquina, pendiente de revisión por el mantenedor regional conforme a P2-002 §3.1. Las especificaciones técnicas centrales permanecen en inglés según §2.2.
>
> ¿Encontraste un error en esta traducción? Tu corrección es una contribución
> bienvenida y valorada: haz un fork del repositorio y abre un pull request en
> https://github.com/NTARI-RAND/Agrinet.

# Agrinet — Documentación Técnica

Marketplace agrícola descentralizado para Brasil. Cubre el ciclo completo de una negociación: publicación de anuncios, pago con escrow (custodia), liberación de fondos al vendedor, chat en tiempo real, antifraude y federación entre nodos.

**Frontend:** Next.js 14 + Tailwind + Shadcn/ui + Framer Motion  
**Backend:** Node.js + Express + MariaDB + Redis  
**Infra:** Docker Compose + GitHub Actions CI/CD + Cloudflare R2

---

## Pipeline Comercial Principal

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

| Capa | Tecnología |
|---|---|
| Backend HTTP | Node.js + Express |
| Base de datos | MariaDB |
| Pagos | Stripe PaymentIntent API |
| Autenticación | JWT + bcryptjs |
| Tiempo real | Socket.IO |
| Caché y colas | Redis + BullMQ |
| Observabilidad | Prometheus + Grafana |
| Carga de archivos | Multer |

---

## Arquitectura en Capas

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

## Índice de la Documentación

| Documento | Contenido |
|---|---|
| [auth.md](./auth.md) | JWT, registro, login, RBAC, niveles de confianza (trust levels), desbloqueo automático |
| [listings.md](./listings.md) | Anuncios, búsqueda, geolocalización, imágenes, estadísticas, historial de precios |
| [transactions.md](./transactions.md) | Transacciones, calificaciones (rating), escrow, webhooks de Stripe, idempotencia, disputas |
| [wallet.md](./wallet.md) | Wallet, libro contable (ledger), débito/crédito atómico, auditoría financiera |
| [chat.md](./chat.md) | Conversaciones, mensajes, estado de entrega (delivery status), paginación, adjuntos, WebSocket, notificaciones |
| [fraud.md](./fraud.md) | Velocity de depósitos y fallos, fraud score, niveles de confianza, cola de fraude (fraud queue), moderación |
| [admin.md](./admin.md) | Dashboard, usuarios, listings, disputas, finanzas, cola de fraude, registro de auditoría (audit log) |
| [federation.md](./federation.md) | Exportación, importación, job de sincronización, bloqueo entre nodos (cross-node blocking) |
| [observability.md](./observability.md) | Métricas de Prometheus por categoría, Grafana, alertas |
| [infra.md](./infra.md) | Rate limiting, Redis, BullMQ, sanitización, variables de entorno |
| [broadcast.md](./broadcast.md) | Sistema de broadcast interno entre componentes |
| [schema.md](./schema.md) | Modelado completo de la base de datos, campos, restricciones, relaciones |
| [decisions.md](./decisions.md) | Decisiones de arquitectura: migración desde DynamoDB, atomicidad, JWT, federación |
| [testing.md](./testing.md) | Scripts de prueba, escenarios validados, cómo ejecutarlos |

---

## Estado de los Módulos

| Módulo | Estado |
|---|---|
| Autenticación JWT + RBAC | Completado |
| Listings con imágenes, estadísticas e historial de precios | Completado |
| Búsqueda con filtros y geolocalización | Completado |
| Transacciones con escrow | Completado |
| Sistema de calificación bilateral | Completado |
| Pagos con Stripe (create, webhook, refund) | Completado |
| Wallet con libro contable y auditoría | Completado |
| Disputas y resolución administrativa | Completado |
| Chat con estado de entrega, paginación y adjuntos | Completado |
| Notificaciones offline y WebSocket | Completado |
| Antifraude (velocity, scoring, niveles de confianza) | Completado |
| Moderación de listings | Completado |
| Panel administrativo completo | Completado |
| Registro de auditoría (audit log) de acciones administrativas | Completado |
| Federación entre nodos | Completado |
| Redis + BullMQ | Completado |
| Prometheus + Grafana | Completado |
| Rate limiting por IP y por usuario | Completado |
| Sanitización y validación de entrada | Completado |
| Auditoría financiera append-only | Completado |
| Object Storage — Cloudflare R2 | Completado |
| Frontend Next.js 14 | Completado |
| CI/CD con GitHub Actions | Completado |
| Integración con PIX | Planificado |
| Listings agrícolas completos (certificaciones, trazabilidad) | Planificado |

---

## Próximas Fases

**Fase 4 — PIX**
Integración con PIX a través de Stripe para uso real en el mercado brasileño. Requiere una tabla dedicada y un webhook seguro para los eventos de PIX.

**Fase 5 — Listings Agrícolas Completos**
Atributos específicos por categoría, certificaciones, trazabilidad de origen y catálogo agrícola detallado.

**Fase 6 — Frontend** ✅ Completado
Next.js 14 con marketplace, chat, perfil, panel de administración y un sistema de diseño agro completo.

**Fase 7 — Infraestructura de Producción** ✅ Completado
Docker Compose, CI/CD con GitHub Actions, imágenes en Docker Hub, respaldos automáticos, Cloudflare R2 para la carga de archivos.

**Fase 8 — Dominio y Deploy**
Apuntar el dominio al servidor, configurar HTTPS (nginx/Caddy), actualizar `NEXT_PUBLIC_API_URL` en el CI.

**Fase 9 — PIX**
Integración con PIX a través de Stripe para uso real en el mercado brasileño.
