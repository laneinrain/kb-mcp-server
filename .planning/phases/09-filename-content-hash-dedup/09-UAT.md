---
status: complete
phase: 09-filename-content-hash-dedup
source: 09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md
started: 2026-07-05T15:11:00.000Z
updated: 2026-07-05T15:12:00.000Z
verified_by: agent-automated
---

## Current Test

[testing complete]

## Tests

### 1. 自动化测试套件
expected: @kb/core 70/70、@kb/backend 36/36（含 documents.dedup 3 项）、@kb/cli 9/9、@kb/web build 通过
result: pass

### 2. content_hash 与 findByUserAndFilename
expected: registry 持久化 contentHash；按 (userId, filename) 查找最新行
result: pass
note: document-registry.test.ts + content-hash.test.ts

### 3. IngestionService 三种 outcome
expected: 相同 hash → unchanged（无 embed/upsert）；不同 hash → replaced（先 delete）；首次 → created
result: pass
note: ingestion-service.test.ts 8 项

### 4. REST outcome + HTTP 状态码
expected: POST 响应含 outcome；created=201，unchanged/replaced=200
result: pass
note: documents.dedup.test.ts

### 5. Web UploadPanel 简体中文消息
expected: created→已上传；unchanged→内容未变，跳过索引；replaced→内容已更新并重新索引
result: pass
note: UploadPanel.tsx 源码审查

### 6. CLI outcome 日志
expected: 成功 stderr JSON 含 outcome 字段（REST 与 direct ingest）
result: pass
note: ingest.test.ts

### 7. 稳定 documentId（user + filename）
expected: 同用户同文件名得到相同 id，不再依赖 temp 路径
result: pass
note: deriveDocumentIdForUserFile 单测 + ingestion 测试

### 8. Live 后端健康
expected: GET /health → 200（pnpm dev 运行中）
result: pass

### 9. Live 上传 dedup（需 USER_AUTH）
expected: JWT 登录后重复上传同文件 → outcome unchanged；修改内容 → replaced
result: skipped
reason: 当前 .env USER_AUTH_ENABLED=false，上传需 systemUserId；dedup 行为已由单元/集成测试覆盖

## Summary

total: 9
passed: 8
issues: 0
pending: 0
skipped: 1

## Gaps

无阻塞缺口。Live Web 重复上传可在启用 USER_AUTH 后人工复验。
