---
status: complete
phase: 04-admin-surfaces-security
source:
  - 04-01-SUMMARY.md
  - 04-02-SUMMARY.md
  - 04-03-SUMMARY.md
  - 04-04-SUMMARY.md
started: 2026-07-04T21:40:00.000Z
updated: 2026-07-04T23:30:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. 开发栈冷启动
expected: pnpm dev 启动全套服务；http://127.0.0.1:5173 显示知识库管理界面
result: pass

### 2. Web 上传文档
expected: 在「文档」Tab 上传 scripts/fixtures/sample.txt（拖拽或选择文件），显示「索引中…」后列表出现已索引行，文件名为 sample.txt（非 UUID 前缀）
result: pass

### 3. Web 文档列表与 ID 复制
expected: 列表含文件名、ID 列（带「复制」按钮）、状态、分块数、集合、更新时间；点击复制可将完整 document ID 写入剪贴板
result: pass

### 4. Web 语义搜索
expected: 「搜索」Tab 输入与样例相关查询，topK=5，「运行搜索」返回带分数、片段、filename、chunkIndex 的结果卡片
result: pass

### 5. Web 删除文档
expected: 点击「删除」→ 确认对话框 → 文档从列表移除
result: pass

### 6. CLI 与 Web 数据一致
expected: pnpm ingest scripts/fixtures/sample.txt 后 kb list 与 Web 列表一致；CLI delete 后刷新 Web 文档消失
result: pass

### 7. 可选 API 密钥认证
expected: AUTH_ENABLED=true + API_KEY 重启后，curl /api/v1/documents 返回 401，/health 正常；Web 弹窗输入密钥、CLI Bearer 均可操作
result: skipped
reason: 用户 skip — 默认开发环境未启用 AUTH

### 8. 可选生产静态托管
expected: pnpm --filter @kb/web build 后 SERVE_WEB=true 启动 backend，http://127.0.0.1:3000 可打开 SPA 并完成上传/搜索
result: pass

## Summary

total: 8
passed: 7
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[none]
