export function HelpPanel() {
  return (
    <section className="help-panel">
      <h2>使用说明</h2>
      <p className="muted">
        本页面为团队内部知识库管理原型，按以下步骤即可上手。
      </p>
      <ol>
        <li>
          <strong>1. 启动服务</strong>
          在项目根目录运行 <code className="mono">pnpm dev</code>
          ，确认 Chroma（8000）、后端（3000）与 Web（5173）均已就绪。
        </li>
        <li>
          <strong>2. 上传文档</strong>
          切换到「文档」页，拖拽或选择 <code className="mono">.txt</code>、
          <code className="mono">.md</code>、
          <code className="mono">.pdf</code>（须为可提取文本的 PDF）进行入库。
        </li>
        <li>
          <strong>3. 测试搜索</strong>
          在「搜索」页输入问题，选择返回条数（topK），点击「运行搜索」查看语义检索结果。
        </li>
        <li>
          <strong>4. MCP 接入（Cursor）</strong>
          构建 MCP 后可在 Cursor 中配置 stdio（
          <code className="mono">apps/mcp-server/dist/stdio.js</code>）或 HTTP（
          <code className="mono">http://127.0.0.1:3100/mcp</code>
          ），调用工具 <code className="mono">search_knowledge</code>。
        </li>
      </ol>
    </section>
  );
}
