# Phase 4 Discussion Log

**Session:** 2026-07-04 — Wave 2 CLI focus (user invoked discuss with `--wave 2` intent)

## Decisions Captured

| Area | Decision | Rationale |
|------|----------|-----------|
| `list` output | Table (id, filename, status, chunkCount, collection, updatedAt) | Operator-friendly terminal read |
| Directory ingest progress | Verbose per-file lines + final summary | Visibility during batch ingest |
| Command entry | Both `kb` bin and `pnpm ingest` alias | Dev ergonomics + explicit CLI name |
| `--collection` | Supported; default `default` | Parity with existing ingest script; future multi-collection |

## User Questions Resolved

- **`--collection` explained:** Chroma collection name — which vector partition documents land in; v1 defaults to `default`.

## Replan Note

User chose **update CONTEXT + replan**. Wave 1 (04-01 auth) already shipped — replan should target **04-02** (and optionally 04-03/04 if CLI UX bleeds into docs) without rewriting 04-01.

## Deferred (unchanged)

- MCP HTTP auth
- Chunk settings web UI
- `list --json` flag (v2)

---

**Session:** 2026-07-04 — Wave 3 Web focus (`--wave 3` intent)

## Decisions Captured

| Area | Decision | Rationale |
|------|----------|-----------|
| UI language | 简体中文 | 小团队内部推广原型 |
| Help / onboarding | 第三 Tab「使用说明」 | 独立 Tab，内嵌快速步骤 |
| Help content | dev → 上传 → 搜索 → MCP | 不含 AUTH 详细教程 |
| Visual system | UI-SPEC 布局/颜色不变 | 只改文案 + Tab 结构 |

## Replan Note

User chose **update CONTEXT only** (no replan). Executor should apply zh-CN + Help tab when implementing 04-03.
