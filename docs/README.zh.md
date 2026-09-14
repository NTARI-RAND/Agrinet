> 社区翻译（草稿）— NTARI 政策 P2-002《全球多语言广播》。源文件：README.md（葡萄牙语原文，快照日期 2026-07-29）。本文为机器辅助的社区翻译草稿，依照 P2-002 §3.1 尚待区域维护者审校。根据 §2.2，核心技术规范仍以英文为准。
>
> 如发现译文有误，欢迎 fork 仓库并提交 Pull Request
> 来改进翻译：https://github.com/NTARI-RAND/Agrinet。翻译修正与代码贡献同样宝贵，我们诚挚欢迎。

# Agrinet — 技术文档

面向巴西的去中心化农产品交易平台（marketplace）。覆盖一笔交易的完整周期：发布商品信息、托管（escrow）支付、向卖家放款、实时聊天、反欺诈，以及节点间联邦（federation）。

**前端：** Next.js 14 + Tailwind + Shadcn/ui + Framer Motion  
**后端：** Node.js + Express + MariaDB + Redis  
**基础设施：** Docker Compose + GitHub Actions CI/CD + Cloudflare R2

---

## 核心交易流程

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

## 技术栈

| 层级 | 技术 |
|---|---|
| HTTP 后端 | Node.js + Express |
| 数据库 | MariaDB |
| 支付 | Stripe PaymentIntent API |
| 身份认证 | JWT + bcryptjs |
| 实时通信 | Socket.IO |
| 缓存与队列 | Redis + BullMQ |
| 可观测性 | Prometheus + Grafana |
| 文件上传 | Multer |

---

## 分层架构

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

## 文档索引

| 文档 | 内容 |
|---|---|
| [auth.md](./auth.md) | JWT、注册、登录、RBAC、信任等级（trust levels）、自动解封 |
| [listings.md](./listings.md) | 商品信息、搜索、地理定位、图片、统计、价格历史 |
| [transactions.md](./transactions.md) | 交易、评分、托管（escrow）、Stripe webhook、幂等性、争议处理 |
| [wallet.md](./wallet.md) | 钱包、会计账本（ledger）、原子化借记/贷记、财务审计 |
| [chat.md](./chat.md) | 会话、消息、送达状态、分页、附件、WebSocket、通知 |
| [fraud.md](./fraud.md) | 充值与失败频率检测（velocity）、欺诈评分、信任等级、欺诈队列、内容审核 |
| [admin.md](./admin.md) | 管理面板、用户、商品信息、争议、财务、欺诈队列、审计日志 |
| [federation.md](./federation.md) | 导出、导入、同步任务、跨节点封禁 |
| [observability.md](./observability.md) | 按类别划分的 Prometheus 指标、Grafana、告警 |
| [infra.md](./infra.md) | 限流（rate limiting）、Redis、BullMQ、输入净化、环境变量 |
| [broadcast.md](./broadcast.md) | 组件间的内部广播系统 |
| [schema.md](./schema.md) | 完整的数据库建模、字段、约束、关系 |
| [decisions.md](./decisions.md) | 架构决策：DynamoDB 迁移、原子性、JWT、联邦 |
| [testing.md](./testing.md) | 测试脚本、已验证的场景、执行方法 |

---

## 模块状态

| 模块 | 状态 |
|---|---|
| JWT 身份认证 + RBAC | 已完成 |
| 带图片、统计和价格历史的商品信息（listings） | 已完成 |
| 带筛选和地理定位的搜索 | 已完成 |
| 带托管（escrow）的交易 | 已完成 |
| 双向评分系统 | 已完成 |
| Stripe 支付（create、webhook、refund） | 已完成 |
| 带会计账本和审计的钱包 | 已完成 |
| 争议处理与管理员裁决 | 已完成 |
| 带送达状态、分页和附件的聊天 | 已完成 |
| 离线通知与 WebSocket | 已完成 |
| 反欺诈（频率检测、评分、信任等级） | 已完成 |
| 商品信息审核 | 已完成 |
| 完整的管理后台 | 已完成 |
| 管理员操作审计日志 | 已完成 |
| 节点间联邦 | 已完成 |
| Redis + BullMQ | 已完成 |
| Prometheus + Grafana | 已完成 |
| 按 IP 和按用户的限流 | 已完成 |
| 输入净化与校验 | 已完成 |
| 仅追加（append-only）的财务审计 | 已完成 |
| 对象存储 — Cloudflare R2 | 已完成 |
| Next.js 14 前端 | 已完成 |
| GitHub Actions CI/CD | 已完成 |
| PIX 集成 | 计划中 |
| 完整的农产品商品信息（认证、可追溯性） | 计划中 |

---

## 后续阶段

**第 4 阶段 — PIX**
通过 Stripe 集成 PIX，以便在巴西市场实际投入使用。需要专用数据表以及用于 PIX 事件的安全 webhook。

**第 5 阶段 — 完整的农产品商品信息**
按类别划分的专属属性、认证、原产地可追溯性，以及详细的农产品目录。

**第 6 阶段 — 前端** ✅ 已完成
Next.js 14，包含交易市场、聊天、个人资料、管理后台以及完整的农业主题设计系统。

**第 7 阶段 — 生产基础设施** ✅ 已完成
Docker Compose、基于 GitHub Actions 的 CI/CD、发布到 Docker Hub 的镜像、自动备份、用于文件上传的 Cloudflare R2。

**第 8 阶段 — 域名与部署**
将域名指向服务器，配置 HTTPS（nginx/Caddy），在 CI 中更新 `NEXT_PUBLIC_API_URL`。

**第 9 阶段 — PIX**
通过 Stripe 集成 PIX，以便在巴西市场实际投入使用。
