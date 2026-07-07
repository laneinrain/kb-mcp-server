# kb-mcp-server

自托管知识库的 TypeScript/Node monorepo。文档经分块与向量化后存入本地 Chroma；AI 客户端通过 **MCP**（stdio 或 Streamable HTTP）进行语义检索，文档的上传与管理走 **REST API / CLI / Web 管理界面**。

## 功能概览

| 能力 | 状态 |
|------|------|
| 文档入库（txt / markdown / 文本层 PDF） | ✅ |
| CherryIn 嵌入（`qwen/qwen3-embedding-8b`） | ✅ |
| 本地 Chroma 向量存储 | ✅ |
| REST API（上传、列表、搜索、健康检查） | ✅ |
| MCP 工具 `search_knowledge`（stdio + HTTP） | ✅ |
| Web 管理界面、JWT 登录、可选 API Key（CLI/服务） | ✅ Phase 4–8 |

## 架构

```
┌─────────────┐     ingest      ┌──────────────┐     embed      ┌─────────┐
│ CLI / REST  │ ──────────────► │ @kb/core     │ ─────────────► │ Chroma  │
│  (backend)  │                 │ Ingestion    │                │ :8000   │
└─────────────┘                 └──────────────┘                └────▲────┘
                                                                   │
┌─────────────┐     search      ┌──────────────┐                   │
│ MCP Client  │ ──────────────► │ SearchService│ ──────────────────┘
│ (stdio/HTTP)│                 │ (@kb/core)   │
└─────────────┘                 └──────────────┘
```

| 端口 | 服务 | 说明 |
|------|------|------|
| 8000 | Chroma | 向量数据库（HTTP sidecar） |
| 3000 | Backend | Fastify REST API + Swagger UI；生产/静态模式下同时托管 Web SPA |
| 5173 | Web（开发） | Vite 开发服务器（HMR）；`/api` 代理到 `:3000` |
| 3100 | MCP HTTP | Streamable HTTP，`POST /mcp` |
| — | MCP stdio | Cursor 等本地客户端，无端口 |

MCP 层**仅负责检索**；入库、删除等管理操作通过 Backend 或 CLI 完成。

## 环境要求

- **Node.js** 24.x
- **pnpm** 11.x
- **Python 3**（Windows 上运行 Chroma：`pnpm setup:chroma` 安装 `chromadb`）
- **CherryIn API Key**（[open.cherryin.cc](https://open.cherryin.cc)）

## 快速开始

### 1. 安装依赖

```bash
git clone https://github.com/laneinrain/kb-mcp-server.git
cd kb-mcp-server
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，至少填写 CHERRYIN_API_KEY
```

### 3. 安装 Chroma（Windows 推荐 Python 方式）

```bash
pnpm setup:chroma
```

### 4. 构建并启动开发环境

```bash
pnpm build
pnpm dev
```

`pnpm dev` 会依次启动 Chroma、Backend（`:3000`）、MCP HTTP（`:3100`）和 **Web 动态前端**（Vite `:5173`）。日常开发在浏览器打开 **http://localhost:5173**。

### 5. 入库文档

```bash
pnpm ingest path/to/document.pdf
pnpm ingest path/to/notes.md --collection default
```

或通过 REST 上传：

```bash
curl -F "file=@./scripts/fixtures/sample.md" http://127.0.0.1:3000/api/v1/documents
```

### 6. 验证搜索

REST：

```bash
curl -X POST http://127.0.0.1:3000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "your question", "topK": 5}'
```

健康检查：

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/health/chroma
curl http://127.0.0.1:3000/health/embeddings
```

API 文档：http://127.0.0.1:3000/docs

## Web 管理界面：动态前端 vs 静态前端

Web 应用（`@kb/web`）有两种运行方式：

| | **动态前端（开发）** | **静态前端（生产 / 一体化）** |
|---|---|---|
| **是什么** | Vite 开发服务器，支持热更新（HMR） | 先 `vite build` 生成静态文件，由 **Backend 托管** |
| **访问地址** | http://localhost:5173 | http://127.0.0.1:3000 |
| **API** | Vite 将 `/api` **代理**到 Backend `:3000` | 与 REST API **同端口**（Backend 同时提供 API + SPA） |
| **何时启用** | 默认 `pnpm dev` | `NODE_ENV=production` 或 `SERVE_WEB=true` |

```
开发（动态）:
  浏览器 → :5173 (Vite) ──proxy /api──→ :3000 (Backend)

生产/静态:
  浏览器 → :3000 (Backend)
              ├── /api/v1/*     REST
              └── /*            apps/web/dist 静态 SPA
```

### 动态前端（开发，日常推荐）

```bash
# 全栈：Chroma + Backend + MCP + Web（Vite :5173）
pnpm dev

# 仅 Web 动态前端（需 Backend 已在 :3000 运行）
pnpm dev:web
# 等价于：
pnpm --filter @kb/web dev
```

浏览器打开 **http://localhost:5173** 登录并使用管理界面。

### 静态前端（构建后由 Backend 托管）

```bash
# 构建 Web 静态资源 → apps/web/dist/
pnpm --filter @kb/web build

# 全量构建（turbo 会先 build @kb/web 再 build @kb/backend）
pnpm build
```

**一键生产/一体化启动（推荐）：**

```bash
pnpm start:prod
```

等价于：`pnpm build` → 设置 `NODE_ENV=production` → 启动 Chroma + Backend（`:3000` 托管 API + 静态 Web）+ MCP HTTP（`:3100`）。

已构建过可跳过编译：

```bash
pnpm start:prod -- --skip-build
```

浏览器打开 **http://127.0.0.1:3000**（页面与 API 同端口）。

**手动分步（可选）：**

```bash
# 方式 A：开发环境验证「单端口部署」（PowerShell）
pnpm --filter @kb/web build
$env:SERVE_WEB="true"; pnpm --filter @kb/backend dev

# 方式 B：仅 Backend 生产模式（需自行启动 Chroma / MCP）
pnpm build
$env:NODE_ENV="production"; pnpm --filter @kb/backend start
```

Linux / macOS 将 `$env:SERVE_WEB="true"` 换成 `SERVE_WEB=true` 前缀即可。

> 默认只运行 `pnpm --filter @kb/backend dev` 且未设置 `SERVE_WEB` 时，`:3000` **仅提供 REST API**，不提供 Web 界面。

### 辅助命令（可选）

```bash
# 预览已 build 的 dist（Vite 自带，默认 :5173，通常不含 /api 代理）
pnpm --filter @kb/web preview
```

### 场景速查

| 场景 | 命令 | 浏览器打开 |
|------|------|------------|
| 改 Web UI、本地上传/搜索测试 | `pnpm dev` | http://localhost:5173 |
| 验证单端口部署形态 | `pnpm start:prod` 或 `SERVE_WEB=true` 启动 backend | http://127.0.0.1:3000 |
| 正式构建产物 | `pnpm start:prod` | Backend :3000 + MCP :3100 |

## MCP 配置

MCP 暴露单一工具 **`search_knowledge`**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `query` | string | 搜索问题（必填，1–2000 字符） |
| `top_k` | number | 返回条数，1–10，默认 5 |
| `collection` | string | 集合名，默认 `default` |

### 方式一：stdio（Cursor 本地，推荐）

**推荐：使用仓库内项目级配置**（已包含在 [`.cursor/mcp.json`](.cursor/mcp.json)，无绝对路径）：

```json
{
  "mcpServers": {
    "kb-mcp-server": {
      "command": "pnpm",
      "args": ["--filter", "@kb/mcp-server", "dev:stdio"],
      "env": { "DOTENV_CONFIG_QUIET": "true" }
    }
  }
}
```

用 Cursor 打开本仓库根目录即可；工作区根目录即 `cwd`，会自动加载根目录 `.env`。

**生产/已构建**（需先 `pnpm --filter @kb/mcp-server build`）：

```json
{
  "mcpServers": {
    "kb-mcp-server": {
      "command": "node",
      "args": ["apps/mcp-server/dist/stdio.js"],
      "env": { "DOTENV_CONFIG_QUIET": "true" }
    }
  }
}
```

> **说明**
>
> - 配置放在 **项目** `.cursor/mcp.json`，不要写 `D:/...` 或 `node.exe` 绝对路径。
> - 全局 `~/.cursor/mcp.json` 仅适合与路径无关的 HTTP 方式（见方式二）；stdio 请用项目级配置。
> - Windows 若 Cursor 找不到 `pnpm`/`node`：将 Node 安装目录加入系统 PATH，或从「以管理员身份运行」的终端启动 Cursor。

### 方式二：Streamable HTTP（远程 / 多客户端）

先运行 `pnpm dev` 或单独启动 MCP HTTP：

```bash
pnpm --filter @kb/mcp-server dev
```

Cursor MCP 配置示例：

```json
{
  "mcpServers": {
    "kb-mcp-server": {
      "url": "http://127.0.0.1:3100/mcp"
    }
  }
}
```

> 浏览器直接访问 `GET /mcp` 会返回 404，这是预期行为；MCP 仅接受 `POST /mcp`。

## 环境变量

完整示例见 [`.env.example`](.env.example)。常用项：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CHERRYIN_API_KEY` | — | CherryIn 嵌入 API 密钥（必填） |
| `CHROMA_HOST` / `CHROMA_PORT` | `localhost` / `8000` | Chroma 地址 |
| `BACKEND_HOST` / `BACKEND_PORT` | `127.0.0.1` / `3000` | REST API |
| `MCP_HTTP_HOST` / `MCP_HTTP_PORT` | `127.0.0.1` / `3100` | MCP HTTP |
| `DEFAULT_COLLECTION` | `default` | 默认向量集合 |
| `EMBEDDING_MODEL` | `qwen/qwen3-embedding-8b` | 嵌入模型 |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `1024` / `154` | 分块参数 |
| `DATA_DIR` | `./data` | 本地数据目录（SQLite、上传缓存） |
| `AUTH_ENABLED` | `false` | 全局 API Key（CLI/服务访问） |
| `USER_AUTH_ENABLED` | `false` | Web 工号登录 + JWT；与 `AUTH_ENABLED` 独立 |

### 鉴权矩阵（Phase 8）

| 客户端 | 凭据 | 文档范围 |
|--------|------|----------|
| **Web 管理界面** | JWT（`POST /api/v1/auth/login`） | 自己的文档 + 系统共享历史文档 |
| **CLI / 自动化** | `AUTH_ENABLED` + `API_KEY`（Bearer） | 全局（服务账号） |
| **MCP** | 无（本阶段未变） | 检索不受用户隔离限制 |

当 `USER_AUTH_ENABLED=true` 时，Web 必须使用 JWT 登录；CLI 需同时设置 `AUTH_ENABLED=true` 与 `API_KEY` 才能通过 REST 入库。

**Mock 模式（`CAS_MOCK=true`）额外能力（v1.3）：**

- 管理员：工号 `00000` / 密码 `admin123`（启动时自动创建，仅脚手架）
- 注册：`POST /api/v1/auth/register`（本地用户，bcrypt，密码至少 8 位）
- JWT 含 `role: admin | user`；JIT CAS 用户仍任意非空密码首次登录
- 管理 API（需 `role=admin` JWT 或 `API_KEY`）：
  - `GET /api/v1/admin/users` — 用户列表 + 文档数
  - `GET /api/v1/admin/users/:userId/documents` — 指定用户文档
  - `GET /api/v1/admin/documents/:documentId` — 任意文档详情
  - `DELETE /api/v1/admin/documents/:documentId` — 删除任意文档
  - `POST /api/v1/admin/users/:userId/documents` — 代用户上传

**切勿将 `.env` 提交到 Git。**

## REST API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 服务存活 |
| `GET` | `/health/chroma` | Chroma 连通性 |
| `GET` | `/health/embeddings` | 嵌入 API 连通性 |
| `POST` | `/api/v1/documents` | 上传文档（multipart） |
| `GET` | `/api/v1/documents` | 列出已入库文档 |
| `GET` | `/api/v1/documents/:id` | 文档详情 |
| `DELETE` | `/api/v1/documents/:id` | 删除文档及向量 |
| `POST` | `/api/v1/search` | 语义搜索 |

## 项目结构

```
kb-mcp-server/
├── apps/
│   ├── backend/          # Fastify REST API（可选托管 Web 静态资源）
│   ├── web/              # React 管理界面（Vite）
│   ├── cli/              # 命令行入库
│   └── mcp-server/       # MCP stdio + Streamable HTTP
├── packages/
│   ├── auth/             # 用户认证（JWT / Mock CAS）
│   ├── config/           # 环境变量与常量
│   └── core/             # 入库、检索、Chroma、嵌入客户端
├── scripts/
│   ├── ingest.ts         # CLI 入库
│   ├── start-chroma.ts   # 启动 Chroma sidecar
│   └── wait-for-chroma.ts
├── .env.example
└── package.json          # pnpm workspace 根
```

## 开发与测试

```bash
# 全量构建
pnpm build

# 全量测试
pnpm test

# 单独启动各服务
pnpm --filter @kb/backend dev
pnpm dev:web                              # Web 动态前端 :5173
pnpm --filter @kb/mcp-server dev          # HTTP :3100
pnpm --filter @kb/mcp-server dev:stdio    # stdio

# 等待 Chroma 就绪
pnpm wait:chroma
```

## 路线图

- **Phase 1–8**（已完成）：平台基础、REST 检索、MCP、Web 管理、用户 JWT 多租户
- **Phase 9+**（规划中）：文件名内容哈希去重等

## 许可证

尚未指定开源许可证。如需公开协作，请自行添加 `LICENSE` 文件。
