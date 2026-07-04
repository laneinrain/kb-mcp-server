# kb-mcp-server

自托管知识库的 TypeScript/Node monorepo。文档经分块与向量化后存入本地 Chroma；AI 客户端通过 **MCP**（stdio 或 Streamable HTTP）进行语义检索，文档的上传与管理走 **REST API / CLI**（Web 管理界面在 Phase 4 规划中）。

## 功能概览

| 能力 | 状态 |
|------|------|
| 文档入库（txt / markdown / 文本层 PDF） | ✅ |
| CherryIn 嵌入（`qwen/qwen3-embedding-8b`） | ✅ |
| 本地 Chroma 向量存储 | ✅ |
| REST API（上传、列表、搜索、健康检查） | ✅ |
| MCP 工具 `search_knowledge`（stdio + HTTP） | ✅ |
| Web 管理界面、可选 API Key 鉴权 | 🔜 Phase 4 |

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
| 3000 | Backend | Fastify REST API + Swagger UI |
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

`pnpm dev` 会依次启动 Chroma、Backend（`:3000`）和 MCP HTTP（`:3100`）。

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

## MCP 配置

MCP 暴露单一工具 **`search_knowledge`**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `query` | string | 搜索问题（必填，1–2000 字符） |
| `top_k` | number | 返回条数，1–10，默认 5 |
| `collection` | string | 集合名，默认 `default` |

### 方式一：stdio（Cursor 本地）

先构建 MCP 包：

```bash
pnpm --filter @kb/mcp-server build
```

在 Cursor 的 MCP 配置（项目 `.cursor/mcp.json` 或全局 `~/.cursor/mcp.json`）中添加：

```json
{
  "mcpServers": {
    "kb-mcp-server": {
      "command": "C:/Program Files/nodejs/node.exe",
      "args": ["D:/project_ai/kb-mcp-server/apps/mcp-server/dist/stdio.js"],
      "cwd": "D:/project_ai/kb-mcp-server"
    }
  }
}
```

> **Windows 提示**
>
> - 将路径改为你本机的项目绝对路径。
> - Cursor GUI 进程可能找不到 `node`，请使用 `node.exe` 的完整路径。
> - 必须设置 `cwd`，以便正确加载项目根目录的 `.env`。
> - 也可使用 `pnpm --filter @kb/mcp-server dev:stdio`，但需保证 `cwd` 为 monorepo 根目录。

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
│   ├── backend/          # Fastify REST API
│   └── mcp-server/       # MCP stdio + Streamable HTTP
├── packages/
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
pnpm --filter @kb/mcp-server dev          # HTTP :3100
pnpm --filter @kb/mcp-server dev:stdio    # stdio

# 等待 Chroma 就绪
pnpm wait:chroma
```

## 路线图

- **Phase 1–3**（已完成）：平台基础、REST 检索、MCP 检索服务
- **Phase 4**（规划中）：Web 管理界面、可选 API Key 鉴权、CLI 增强

## 许可证

尚未指定开源许可证。如需公开协作，请自行添加 `LICENSE` 文件。
