> 社区翻译（草稿）— NTARI 政策 P2-002《全球多语言广播》。来源：README.md（葡萄牙语原版，快照日期 2026-07-29）。根据 P2-002 §3.1，本文为机器辅助的社区翻译草稿，尚待区域维护者审校。根据 §2.2，核心技术规范仍以英文为准。
>
> 如发现译文有误，欢迎 fork 仓库并提交 Pull Request
> 来改进翻译：https://github.com/NTARI-RAND/Agrinet。翻译修正与代码贡献同样宝贵，我们诚挚欢迎。

# Agrinet — 去中心化农业交易市场

面向巴西的开源农业贸易平台。通过一个安全的交易市场连接生产者、买家和服务提供商，提供托管（escrow）支付、实时聊天、反欺诈机制以及节点间的联邦同步。

> 派生自原始项目 [NTARI-RAND/Agrinet](https://github.com/NTARI-RAND/Agrinet) — 由 [Carlos Zamboni](https://github.com/CarlosZambonii) 针对巴西市场进行适配。

**在线部署：** [https://agrinet.duckdns.org](https://agrinet.duckdns.org)

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | Next.js 14 (App Router) + Tailwind CSS + Shadcn/ui + Framer Motion |
| 后端 | Node.js + Express |
| 数据库 | MariaDB |
| 缓存与队列 | Redis + BullMQ |
| 支付 | Stripe（PaymentIntent + 托管支付） |
| 图片上传 | Cloudflare R2 |
| 实时通信 | Socket.IO |
| 可观测性 | Prometheus + Grafana |
| 身份认证 | JWT + bcryptjs |
| 反向代理 | nginx（HTTPS、路由、WebSocket） |
| SSL | 通过 Certbot 使用 Let's Encrypt |
| 基础设施 | Docker + Docker Compose |
| CI/CD | GitHub Actions → Docker Hub → VPS |

---

## 功能特性

- **交易市场** — 谷物、水果、牲畜、机械等类目的商品发布，支持筛选、搜索和排序
- **托管支付** — Stripe PaymentIntent，由卖家确认放款，支持自动退款
- **钱包** — 余额、收支明细，以及带审计功能的会计账本
- **实时聊天** — Socket.IO，支持轮询回退、输入状态提示、消息通知
- **反欺诈** — 速率检测（velocity check）、欺诈评分、信任等级、审核队列
- **联邦机制** — 在网络各节点之间同步商品信息与封禁记录
- **管理后台** — 统计数据、商品审核、纠纷处理、审计日志
- **图片上传** — 拖拽上传，存储于 Cloudflare R2
- **可观测性** — Prometheus 指标、Grafana 仪表盘、已配置的告警

---

## 使用 Docker 运行（推荐）

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

| 服务 | 本地 URL |
|---|---|
| 前端 | http://localhost:3000 |
| API | http://localhost:5000 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

若还需启动监控组件：
```bash
docker compose --profile monitoring up -d
```

### 在 VPS 上通过 HTTPS 部署

生产环境使用 nginx 作为反向代理，并通过 Let's Encrypt 提供 SSL。完整操作步骤请参阅 [`docs/infra.md`](./docs/infra.md)。

---

## 本地运行（开发环境）

**前置条件：** Node.js 20+、MariaDB、Redis

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

## 环境变量

全部变量均记录在 [`backend/.env.example`](./backend/.env.example) 中。核心变量如下：

| 变量 | 说明 |
|---|---|
| `JWT_SECRET` | 用于 JWT 令牌的密钥 |
| `API_KEY` | API 访问密钥（请求头 `X-API-Key`） |
| `STRIPE_SECRET_KEY` | Stripe 私密密钥 |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook 密钥 |
| `R2_ACCOUNT_ID` | Cloudflare 账户 ID |
| `R2_ACCESS_KEY_ID` | R2 存储桶的 Access Key |
| `R2_SECRET_ACCESS_KEY` | R2 存储桶的 Secret Key |
| `R2_PUBLIC_URL` | 存储桶的公开 URL（例如：`https://pub-xxx.r2.dev`） |

---

## CI/CD

流水线由两个串联的 workflow 组成：

**1. `build-and-push.yml`** — 每当 `main` 分支上有涉及 `backend/`、`frontend/` 或 `infra/` 的推送时触发。构建以下三个镜像并发布到 Docker Hub：

- `caza6367/agrinet-api:latest`
- `caza6367/agrinet-frontend:latest`
- `caza6367/agrinet-federation-sync:latest`

**2. `deploy.yml`** — 在构建 workflow 结束后自动触发。通过 SSH 登录 VPS 并执行 `docker compose pull && up -d`。

**仓库中需要配置的 Secrets**（`Settings → Secrets → Actions`）：

| Secret | 说明 |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub 用户名 |
| `DOCKERHUB_TOKEN` | Docker Hub 访问令牌 |
| `NEXT_PUBLIC_API_URL` | API 的公开 URL（例如：`https://agrinet.duckdns.org`） |
| `NEXT_PUBLIC_API_KEY` | 供前端使用的 API 密钥 |
| `JWT_SECRET` | JWT 密钥（使用 `openssl rand -hex 32` 生成） |
| `API_KEY` | API 访问密钥（使用 `openssl rand -hex 32` 生成） |
| `DB_PASSWORD` | MariaDB 密码 |
| `STRIPE_SECRET_KEY` | Stripe 私密密钥 |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook 密钥 |
| `STRIPE_PUBLISHABLE_KEY` | Stripe 公开密钥 |
| `R2_ACCOUNT_ID` | Cloudflare 账户 ID |
| `R2_ACCESS_KEY_ID` | R2 存储桶的 Access Key |
| `R2_SECRET_ACCESS_KEY` | R2 存储桶的 Secret Key |
| `R2_PUBLIC_URL` | R2 存储桶的公开 URL |
| `ALLOWED_ORIGINS` | CORS 允许的来源（例如：`https://agrinet.duckdns.org`） |
| `VPS_HOST` | VPS 的 IP 地址或主机名 |
| `VPS_USER` | VPS 的 SSH 用户名 |
| `VPS_SSH_KEY` | 用于访问 VPS 的 SSH 私钥 |

---

## 项目结构

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

## 测试

```bash
cd backend
npm test          # 24 testes unitários (Jest)
```

覆盖的测试套件：输入净化、JWT、authMiddleware、fraudService。

---

## 技术文档

完整文档位于 [`docs/`](./docs/README.md)：

| 文档 | 内容 |
|---|---|
| [auth.md](./docs/auth.md) | JWT、注册、登录、RBAC、信任等级 |
| [listings.md](./docs/listings.md) | 商品发布、搜索、筛选、图片、统计 |
| [transactions.md](./docs/transactions.md) | 托管支付、Stripe webhooks、纠纷、评价 |
| [wallet.md](./docs/wallet.md) | 余额、会计账本、财务审计 |
| [chat.md](./docs/chat.md) | 消息、Socket.IO、通知 |
| [fraud.md](./docs/fraud.md) | 速率检测、欺诈评分、内容审核 |
| [admin.md](./docs/admin.md) | 管理后台、审计日志、纠纷处理 |
| [federation.md](./docs/federation.md) | 网络节点间的同步 |
| [observability.md](./docs/observability.md) | Prometheus、Grafana、告警 |
| [schema.md](./docs/schema.md) | 完整的数据库建模 |
| [testing.md](./docs/testing.md) | 测试方法与已验证的场景 |
| [decisions.md](./docs/decisions.md) | 架构决策及其背景 |

---

## 维护者

**Carlos Zamboni**
- GitHub: [github.com/CarlosZambonii](https://github.com/CarlosZambonii)
- LinkedIn: [linkedin.com/in/carloszambonii](https://www.linkedin.com/in/carloszambonii/)

---

## 许可证

[AGPL-3.0](./LICENSE) — 开放源代码，并且必须保持开放。
