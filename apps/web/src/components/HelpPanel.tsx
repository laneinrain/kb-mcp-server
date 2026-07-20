import { useState } from "react";
import { getAccessToken } from "../lib/auth-token.js";

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) {
    throw new Error("clipboard unavailable");
  }
}

export function HelpPanel() {
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "missing" | "failed"
  >("idle");

  async function handleCopyJwt() {
    const token = getAccessToken();
    if (!token) {
      setCopyStatus("missing");
      return;
    }

    try {
      await copyText(token);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 3000);
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <section className="help-panel">
      <h2>使用说明</h2>
      <p className="muted">
        团队内部知识库：在 Web
        中上传与检索文档，并通过 MCP（Cursor / CodeBuddy 等）在 AI
        客户端中语义搜索。以下为操作指南。
      </p>

      <div className="help-section">
        <h3>快速开始</h3>
        <ol>
          <li>
            <strong>启动服务</strong>
            在项目根目录运行 <code className="mono">pnpm dev</code>
            （或生产 <code className="mono">pnpm start:prod</code>
            ）。确认端口：Chroma <code className="mono">8000</code>、Backend{" "}
            <code className="mono">3000</code>、MCP HTTP{" "}
            <code className="mono">3100</code>；开发时 Web 为{" "}
            <code className="mono">5173</code>，生产静态页与 API 同在{" "}
            <code className="mono">3000</code>。
          </li>
          <li>
            <strong>登录</strong>
            使用工号登录（Mock 管理员示例：工号{" "}
            <code className="mono">00000</code> / 密码{" "}
            <code className="mono">admin123</code>）。
          </li>
          <li>
            <strong>上传文档</strong>
            打开「文档」页，上传 <code className="mono">.txt</code>、
            <code className="mono">.md</code> /{" "}
            <code className="mono">.markdown</code> 或含可提取文本的{" "}
            <code className="mono">.pdf</code>。
          </li>
          <li>
            <strong>测试搜索</strong>
            在「搜索」页输入问题，设置 topK，查看语义检索结果（可含
            Rerank）。
          </li>
        </ol>
      </div>

      <div className="help-section">
        <h3>鉴权与文档范围</h3>
        <p className="muted">
          当 <code className="mono">USER_AUTH_ENABLED=true</code> 且 MCP 侧{" "}
          <code className="mono">MCP_AUTH_REQUIRED=true</code>
          （默认）时，检索按凭据隔离。JWT 可从下方「复制当前登录 JWT」获取。
        </p>
        <div className="help-table-wrap">
          <table className="help-table">
            <thead>
              <tr>
                <th>客户端</th>
                <th>凭据</th>
                <th>文档范围</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Web</td>
                <td>登录 JWT</td>
                <td>自己的文档 + 系统共享历史文档</td>
              </tr>
              <tr>
                <td>MCP HTTP</td>
                <td>
                  <code className="mono">Authorization: Bearer</code> JWT 或{" "}
                  <code className="mono">API_KEY</code>
                </td>
                <td>JWT → 用户文档集；API_KEY → 全局</td>
              </tr>
              <tr>
                <td>MCP stdio</td>
                <td>
                  环境变量 <code className="mono">MCP_USER_TOKEN</code>（JWT）
                </td>
                <td>同上（进程绑定单用户）</td>
              </tr>
              <tr>
                <td>CLI / 自动化</td>
                <td>
                  <code className="mono">AUTH_ENABLED</code> +{" "}
                  <code className="mono">API_KEY</code>
                </td>
                <td>全局（服务账号）</td>
              </tr>
              <tr>
                <td>任意 MCP（鉴权开启且无凭据）</td>
                <td>—</td>
                <td>HTTP 401 / stdio 启动失败</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="help-section">
        <h3>MCP 工具</h3>
        <p className="muted">
          MCP 仅负责检索，不提供上传/删除。入库请用 Web、REST 或 CLI。
        </p>
        <div className="help-table-wrap">
          <table className="help-table">
            <thead>
              <tr>
                <th>工具</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code className="mono">search_knowledge</code>
                </td>
                <td>
                  语义搜索；参数 <code className="mono">query</code>（必填）、
                  <code className="mono">top_k</code>（1–10）、
                  <code className="mono">collection</code>
                </td>
              </tr>
              <tr>
                <td>
                  <code className="mono">read_around</code>
                </td>
                <td>
                  按 <code className="mono">document_id</code> +{" "}
                  <code className="mono">chunk_index</code> 展开邻近块
                </td>
              </tr>
              <tr>
                <td>
                  <code className="mono">read_file</code>
                </td>
                <td>
                  按 <code className="mono">document_id</code>{" "}
                  读取有界全文（按块序）
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted">
          默认 MCP HTTP 地址：
          <code className="mono">http://127.0.0.1:3100/mcp</code>
        </p>
      </div>

      <div className="help-section">
        <h3>客户端接入 — Cursor</h3>
        <p className="muted">
          先登录本 Web 获取 JWT，再写入 MCP 配置。
          <strong>不要</strong>把真实 token 提交到 Git。推荐 HTTP（可带{" "}
          <code className="mono">headers</code>）。
        </p>
        <p>
          <strong>方式一：Streamable HTTP（推荐）</strong>
        </p>
        <pre className="mono">{`{
  "mcpServers": {
    "kb-mcp-server": {
      "url": "http://127.0.0.1:3100/mcp",
      "headers": {
        "Authorization": "Bearer <jwt>"
      }
    }
  }
}`}</pre>
        <p>
          <strong>方式二：stdio（本地单用户）</strong>
          在仓库根目录作为工作区打开时使用；将{" "}
          <code className="mono">&lt;jwt&gt;</code> 换成当前登录令牌。
        </p>
        <pre className="mono">{`{
  "mcpServers": {
    "kb-mcp-server": {
      "command": "pnpm",
      "args": ["--filter", "@kb/mcp-server", "dev:stdio"],
      "env": {
        "DOTENV_CONFIG_QUIET": "true",
        "MCP_USER_TOKEN": "<jwt>"
      }
    }
  }
}`}</pre>
        <p className="muted">
          配置可放在项目 <code className="mono">.cursor/mcp.json</code>
          。stdio 请避免写死绝对路径。
        </p>
      </div>

      <div className="help-section">
        <h3>客户端接入 — CodeBuddy</h3>
        <p className="muted">
          CodeBuddy（及同类支持 MCP 的客户端）与 Cursor
          使用相同凭据语义：HTTP 填 MCP URL + Authorization
          头，或本地命令 + 环境变量。若产品 UI
          字段名不同，请映射为下列含义即可。
        </p>
        <p>
          <strong>HTTP / 远程 MCP</strong>
        </p>
        <ul>
          <li>
            URL：
            <code className="mono">http://127.0.0.1:3100/mcp</code>
          </li>
          <li>
            Header：
            <code className="mono">Authorization</code> ={" "}
            <code className="mono">Bearer &lt;jwt&gt;</code>
          </li>
        </ul>
        <pre className="mono">{`{
  "mcpServers": {
    "kb-mcp-server": {
      "url": "http://127.0.0.1:3100/mcp",
      "headers": {
        "Authorization": "Bearer <jwt>"
      }
    }
  }
}`}</pre>
        <p>
          <strong>本地命令（stdio 等价）</strong>
        </p>
        <pre className="mono">{`{
  "mcpServers": {
    "kb-mcp-server": {
      "command": "pnpm",
      "args": ["--filter", "@kb/mcp-server", "dev:stdio"],
      "env": {
        "DOTENV_CONFIG_QUIET": "true",
        "MCP_USER_TOKEN": "<jwt>"
      }
    }
  }
}`}</pre>
        <p className="muted">
          工作目录须为本仓库根目录，以便解析{" "}
          <code className="mono">pnpm</code> workspace 与{" "}
          <code className="mono">.env</code>。
        </p>
      </div>

      <div className="help-section">
        <h3>复制当前登录 JWT</h3>
        <p className="muted">
          将当前浏览器会话中的 access token
          复制到剪贴板，粘贴到 Cursor / CodeBuddy 的{" "}
          <code className="mono">Bearer &lt;jwt&gt;</code> 或{" "}
          <code className="mono">MCP_USER_TOKEN</code>。页面<strong>不会</strong>
          展示完整 token 文本。
        </p>
        <div className="help-copy-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              void handleCopyJwt();
            }}
          >
            复制当前登录 JWT
          </button>
          {copyStatus === "copied" ? (
            <span className="banner-success help-copy-status">已复制</span>
          ) : null}
          {copyStatus === "missing" ? (
            <span className="banner-error help-copy-status">
              未登录或令牌缺失，请先登录
            </span>
          ) : null}
          {copyStatus === "failed" ? (
            <span className="banner-error help-copy-status">
              复制失败，请检查浏览器剪贴板权限后重试
            </span>
          ) : null}
        </div>
        <ul className="help-security-notes">
          <li>JWT 等同于登录态，勿提交到 Git、截图或公开聊天。</li>
          <li>令牌过期后 MCP 会鉴失败，请重新登录本站再复制。</li>
          <li>
            stdio 的 <code className="mono">MCP_USER_TOKEN</code>{" "}
            绑定整个进程，适合单用户本地开发。
          </li>
        </ul>
      </div>
    </section>
  );
}
