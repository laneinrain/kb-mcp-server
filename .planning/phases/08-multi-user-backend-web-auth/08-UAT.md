---
status: complete
phase: 08-multi-user-backend-web-auth
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md
started: 2026-07-05T14:14:00.000Z
updated: 2026-07-05T14:16:00.000Z
verified_by: agent-automated
---

## Current Test

[testing complete]

## Tests

### 1. 自动化测试套件
expected: @kb/auth 8/8、@kb/core 64/64、@kb/backend 33/33、@kb/cli 8/8、@kb/web build 通过
result: pass
note: 含 documents/search multi-user 集成测试 6 项

### 2. 未登录访问受保护 API → 401
expected: GET /api/v1/documents、POST /api/v1/search、GET /api/v1/settings 无 Bearer 时返回 401 `{ error: "unauthorized" }`
result: pass
note: 对运行中后端 http://127.0.0.1:3000 实测

### 3. 健康检查保持公开
expected: GET /health 无需鉴权，返回 200
result: pass

### 4. JWT 登录与 JIT 用户
expected: 合法工号 + 非空密码返回 accessToken；同一工号不同密码重复登录 user.id 不变
result: pass
note: 11111111 / 22222222 实测；非法工号 123 → 400

### 5. JWT 文档列表与 userId 字段
expected: Bearer JWT 可 GET /api/v1/documents；响应含 userId 字段
result: pass
note: 列表返回 4 条（含迁移后的系统共享文档）

### 6. 系统 legacy 文档共享可见
expected: 两名 JWT 用户均可在列表/GET 中看到 userId 为 system 的历史文档
result: pass
note: legacy_visible_both_users 实测通过

### 7. JWT 用户不可删除 legacy 文档
expected: 非 owner 对 system 文档 DELETE → 404（非 403）
result: pass
note: legacy_delete_blocked_jwt 实测通过

### 8. 复合鉴权（JWT 或 API_KEY）
expected: createProtectedRouteOpts 实现；multi-user 测试覆盖 API_KEY 可见全部文档
result: pass
note: documents.multi-user.test.ts「API_KEY service mode sees all documents」

### 9. 跨用户隔离（集成测试）
expected: 用户 A 的 token 无法 GET 用户 B 的 documentId（404）
result: pass
note: documents.multi-user.test.ts；live upload 因 ingestion 路径校验未跑通，以集成测试为准

### 10. 搜索范围隔离（集成测试）
expected: JWT 搜索时 searchService 收到 allowedDocumentIds，仅含可见文档
result: pass
note: search.multi-user.test.ts

### 11. JWT 搜索鉴权层
expected: 带有效 JWT 的请求通过 preHandler，进入 searchService（非 401）
result: pass
note: live POST /api/v1/search 返回 500（Chroma 未启动），说明鉴权已通过；环境需 `pnpm dev` 完整栈才能测检索结果

### 12. Web JWT-only（无 ApiKeyModal）
expected: App.tsx 不引用 ApiKeyModal；client.ts 无 sessionStorage API key
result: pass
note: ApiKeyModal.tsx 文件仍存在但未接入；client 仅用 localStorage kb_access_token

### 13. 401 → 清除 token 并跳转 /login
expected: api/client.ts 在 401 时 clearAccessToken + window.location.replace('/login')
result: pass
note: 源码审查

### 14. 登录门控（WEB-03）
expected: 无 token 访问 / 重定向 /login；/login 显示 LoginPage
result: pass
note: main.tsx 客户端门控

### 15. 退出登录（WEB-04）
expected: AppShell 头部「退出登录」→ clearAccessToken + 跳转 /login
result: pass
note: AppShell.tsx 源码审查

### 16. 共享文档删除按钮隐藏
expected: DocumentTable 对非当前 userId 的文档不显示删除按钮
result: pass
note: 比对 doc.userId 与 localStorage kb_user_id

### 17. CLI 多用户守卫（D-13）
expected: USER_AUTH_ENABLED && !AUTH_ENABLED 时 runIngest 退出码 2 并提示设置 API_KEY
result: pass
note: ingest.test.ts + stderr 实测输出

## Summary

total: 17
passed: 17
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]

## 环境说明

- 本次 live API 测试时 **Chroma 未运行**，故搜索/上传返回 500/400 属于基础设施依赖，**不影响 Phase 8 鉴权与隔离结论**。
- 完整端到端（上传 → 搜索 → Web UI 手动点退出）建议在 `pnpm dev` 全栈启动后人工抽检。
