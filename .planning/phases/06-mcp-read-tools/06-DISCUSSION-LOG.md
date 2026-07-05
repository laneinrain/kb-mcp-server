# Phase 6: MCP Read Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 6-MCP Read Tools
**Areas discussed:** Agent 工作流提示 (Agent workflow hints)

---

## Agent 工作流提示

User selected this gray area from: Agent workflow hints, MCP error format, Response payload, Oversized center chunk.

| Option | Description | Selected |
|--------|-------------|----------|
| 明确前置 | 描述中写明先 search 再 read_around | |
| 独立描述 | 不绑定 search_knowledge | |
| 你决定 | 按 MCP 惯例 | ✓ (Q1) |
| 详细 | 含流程 + 参数来源 + 截断说明 | |
| 简洁 | 一两句 + schema | |
| 对齐 search | 与 search_knowledge 同风格 | ✓ (Q2) |
| 区分用途 | read_file vs read_around 场景 | |
| 各说各的 | 不互相引用 | |
| 你决定 | read_file 场景说明 | ✓ (Q3) |
| 内嵌示例 | description 里一行调用示例 | ✓ (Q4) |
| 不写示例 | 靠 schema 与外部文档 | |
| 仅参数提示 | 只补充 window 默认值 | |

**Q1 — read_around 是否写明 search 为前置？** User's choice: **你决定** (Claude follows MCP best practice; CONTEXT locks light mention via inline example rather than tutorial steps)

**Q2 — 描述详细程度？** User's choice: **对齐 search_knowledge** — one concise English sentence + schema

**Q3 — read_file 是否对比 read_around？** User's choice: **你决定**

**Q4 — 是否内嵌调用示例？** User's choice: **内嵌示例** — one-line example with document_id + chunk_index from search hit

**Notes:** User requested 中文 explanation of “Agent 工作流提示” before continuing. Clarified that MCP tool descriptions guide AI clients through search → read_around workflow; user confirmed understanding and said 继续 to generate CONTEXT.

---

## Gray areas not discussed

Presented but not selected: MCP error format, Response payload shape, Oversized center chunk — left to Claude's discretion in CONTEXT.md per Phase 3/5 patterns.

## Claude's Discretion

- Q1: search_knowledge as named prerequisite in prose
- Q3: read_file vs read_around usage contrast in description
- Error format, full metadata passthrough, center-chunk MCP cap (see CONTEXT `<decisions>` Claude's Discretion)

## Deferred Ideas

- REST read endpoints (API-06)
- Error format / response slimming as explicit user decisions — skipped; planner defaults apply
