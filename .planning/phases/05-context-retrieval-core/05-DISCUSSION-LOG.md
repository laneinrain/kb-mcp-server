# Phase 5: Context Retrieval Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 5-Context Retrieval Core
**Areas discussed:** read_around window semantics, admin grouped configuration

---

## read_around window semantics

| Option | Description | Selected |
|--------|-------------|----------|
| 对称 ±N | window=2 → center±2，最多 5 块 | ✓ |
| window = 总块数上限 | 参数名易混淆 | |
| 仅向后扩展 | 只向高 index 扩展 | |

**User's choice:** 对称 ±N

---

| Option | Description | Selected |
|--------|-------------|----------|
| 默认 1，最大 3 | 保守 token 用量 | ✓ |
| 默认 2，最大 5 | 与 search topK 量级匹配 | |
| 默认 3，最大 10 | 更大上下文 | |

**User's choice:** 默认 window=1，max=3

---

| Option | Description | Selected |
|--------|-------------|----------|
| 自动压到上限 + metadata | window_requested / window_applied | ✓ |
| 超出就报错 | Agent 需重试 | |
| 自动压到上限，不说明 | 无 metadata | |

**User's choice:** 静默 clamp + metadata（用户先问了「静默 clamp 什么意思」— 解释为不报错、自动压到合法上限）

---

| Option | Description | Selected |
|--------|-------------|----------|
| 边界 shrink + chunk_range | 能拿多少拿多少 | ✓ |
| 边界不足则报错 | 即使有部分可读 | |
| shrink + boundary 标记 | truncated_by_boundary | |

**User's choice:** 边界 shrink，响应含 chunk_range

---

| Option | Description | Selected |
|--------|-------------|----------|
| 每块全文 | Chroma 完整 chunk 文本 | ✓ |
| 500 字截断 | 与 search 一致 | |
| 仅 center 全文 | 邻居截断 | |

**User's choice:** 每块返回全文

---

| Option | Description | Selected |
|--------|-------------|----------|
| center 必须 + is_center | 标记命中块 | ✓ |
| center 必须不标记 | | |
| 只返回邻居 | 不含 center | |

**User's choice:** 必须包含 center，is_center: true

---

| Option | Description | Selected |
|--------|-------------|----------|
| chunk_index 升序 | 连续阅读 | ✓ |
| center 优先 | | |
| 不保证顺序 | | |

**User's choice:** 升序

---

| Option | Description | Selected |
|--------|-------------|----------|
| 总字符上限 32KB | MCP-09 有界 | ✓ |
| 仅靠 window 限制 | 无总 cap | |
| 总上限 8KB | 偏保守 | |

**User's choice:** read_around 总上限 32_000 字符（可配置）

---

## Admin grouped configuration

**User's choice (freeform):** 服务端后台页面可以配置这些参数，聚类配置

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 5 一并做 Web 设置页 | settings + UI 同阶段 | ✓ |
| Phase 5 存配置，UI 稍后 | 拆分阶段 | |
| 仅 env | 无后台页 | |

**User's choice:** Phase 5 同时做 settings 扩展 + Web 管理页「上下文检索」分组

---

## Claude's Discretion

- Data fetch path (registry + Chroma batch get)
- Error JSON shape for unknown doc / invalid index
- read_file default max chunks/chars
- Exact REST route shape for settings PATCH

## Deferred Ideas

- MCP tool exposure — Phase 6
- API-06 REST read tools — future
