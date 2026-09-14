> 社区翻译（草稿）— NTARI 政策 P2-002《全球多语言广播》。来源：README.md（英文原版，2026-07-29 快照）。本文件为机器辅助的社区翻译草稿，依据 P2-002 §3.1 尚待区域维护者审校。核心技术规范依据 §2.2 仍以英文为准。
>
> 如发现译文有误，欢迎 fork 仓库并提交 Pull Request
> 来改进翻译：https://github.com/NTARI-RAND/Agrinet。翻译修正与代码贡献同样宝贵，我们诚挚欢迎。

# Fruitful 后端（Agrinet 平台）

本后端基于 Node.js、Express 和 Server-Sent Events（SSE）为 Agrinet 各项服务提供支持，用于流式推送聊天更新。

## 概述

- 运行时：Node.js + Express
- 数据库：MariaDB / MySQL（本地优先架构）
- 流式传输：SSE（`/events`、`/stream/:conversationId`）
- 认证：JWT 中间件；部分端点支持 API Key
- 队列：使用 BullMQ 处理短信和后台任务
- 上传：文件存储在 `backend/uploads` 目录下，通过 `/uploads` 提供访问

## 快速开始

```bash
cd backend
npm install
node server.js
```

基于 Docker 的本地开发：
```bash
docker compose up --build
```

API 通常运行在 5000 端口（参见 docker-compose）。

## 环境变量

必需（或通过 `.env` 设置）：
- JWT_SECRET
- TWILIO_SID、TWILIO_AUTH_TOKEN、TWILIO_FROM_NUMBER（用于短信；可选 TWILIO_STATUS_CALLBACK_URL）
- STRIPE_KEY（如启用充值功能）

## Redis 配置

要运行 Redis，请确保它已包含在你的 `docker-compose.yml` 文件中：

```yml
redis:
  image: redis:latest
  command: redis-server
  ports:
    - "6379:6379"
  networks:
    - backend
```

在 `.env` 中设置以下环境变量：
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`

这些设置使后端服务能够连接到 Redis，用于队列管理及其他任务。

## 路由

主要挂载点（参见 `server.js`）：
- `/health` – 健康检查
- `/uploads/*` – 静态上传文件
- `/events` – SSE 广播通道
- `/stream/:conversationId` – 按会话划分的 SSE 流

业务域路由（非最小模式下）：
- `/api/marketplace` → 交易市场
- `/users` → 用户管理
- `/federation` → 联邦同步

## 聊天与流式传输

端点（供聊天 UI 使用）：
- `GET /conversations` → 获取会话列表
- `POST /conversations` → 创建会话
- `PUT /conversations/:id` → 重命名会话
- `POST /conversations/:id/pin` → 切换置顶状态
- `DELETE /conversations/:id` → 删除会话
- `GET /messages/:conversationId` → 获取消息列表
- `POST /messages/:conversationId` → 发送消息（可附带文件）
- `GET /stream/:conversationId`（SSE）→ 事件：
  - `token`: `{ id, token }`
  - `message`: `{ message }`

服务端事件发送器（全局）：
- `emitToken(conversationId, id, token)`
- `emitMessage(conversationId, message)`

## 交易与通知

- `POST /api/marketplace/transactions`
- `POST /api/marketplace/transactions/release-escrow`
- `POST /api/marketplace/transactions/rate`
- `POST /api/marketplace/transactions/ping`

## 安全与认证

- CORS：仅限 `https://www.ntari.org`
- JWT：中间件对受保护路由强制执行授权
- SSE 的 API Key：聊天 UI 在 SSE 请求中通过 `x-api-key` 查询参数传递 API Key；服务端在 `/events` 和 `[...]` 上接受 `x-api-key`（为向后兼容也接受 `api_key`）

## 任务与短信

- `bull/smsQueue.js`：通过 Twilio 发送短信的 BullMQ 工作进程
- `routes/smsRoutes.js`：处理入站消息与状态回调的 webhook
- Docker Compose 中的后台工作进程：
  - `federation-sync`、`key-expiry-cleaner`

## 常用路径

- 入口：`backend/server.js`
- 模型：`backend/models/*`
- 路由：`backend/routes/*`
- 仓储层：`backend/repositories/*`
- 工具函数：`backend/utils/*`
- 队列：`backend/bull/*`
- 上传目录：`backend/uploads`

## 测试

当前测试命令请参见 `backend/package.json`。

---
欢迎贡献！请通过在各业务域文件夹中添加路由和逻辑来保持 `server.js` 精简。
