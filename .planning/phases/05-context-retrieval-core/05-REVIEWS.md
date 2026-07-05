---
phase: 5
reviewers: [orchestrator-fallback]
reviewed_at: 2026-07-05T14:45:00+08:00
plans_reviewed:
  - 05-01-PLAN.md
  - 05-02-PLAN.md
  - 05-03-PLAN.md
review_note: >
  External AI CLIs (gemini, claude, codex, opencode, qwen) not installed on this machine.
  Cursor editor CLI present but has no `agent` subcommand. Review below is orchestrator
  adversarial pass — not true cross-model peer review. Install gemini or codex CLI and
  re-run `/gsd-review --phase 5 --all` for independent model feedback.
---

# Cross-AI Plan Review — Phase 5

## Orchestrator Adversarial Review (fallback)

### Summary

Phase 5 plans are well-structured, traceable to CONTEXT decisions D-01–D-13, and follow established monorepo patterns (SearchService factory, Fastify Zod routes, React admin panels). The three-wave split (foundation → ContextService → admin API/UI) is sound. Main risks are **SQLite migration edge cases**, **Chroma partial ID responses**, **MCP server not receiving ContextService in Phase 5** (Phase 6 dependency), and **grep-based acceptance criteria** that can pass without behavioral correctness.

### Strengths

- Clear requirement mapping: CORE-01/CORE-02 assigned; D-01–D-08 concentrated in 05-02; admin settings D-09–D-13 in 05-01/05-03
- Validation-before-fetch pattern (CORE-02) explicitly tested with `getByIds` not called on errors
- SQLite ALTER migration called out — critical for v1.0 upgrades (not just CREATE TABLE IF NOT EXISTS)
- Window semantics from discuss-phase fully encoded: symmetric ±N, clamp, shrink, center marker, 32KB cap
- Threat models per plan with STRIDE register — unusual but useful for settings tampering and partial leak
- Human-verify checkpoint on 05-03 for admin save/reload — appropriate for `autonomous: false`
- Explicit deferrals: no MCP tools, no API-06 REST read endpoints, chunk settings read-only in UI

### Concerns

| Severity | Issue | Plan | Recommendation |
|----------|-------|------|----------------|
| **HIGH** | **MCP server not wired in Phase 5** — `apps/mcp-server` still only has SearchService; Phase 6 must inject ContextService + share settingsStore path or MCP will use stale env-only defaults | 05-03 | Add explicit Phase 6 dependency note in 05-03 SUMMARY; verify MCP `createAppServices` equivalent reads same SQLite in Phase 6 planning |
| **HIGH** | **Chroma `getByIds` partial results** — if some IDs missing (registry/Chroma drift), plan doesn't specify whether to error or return partial with metadata | 05-01, 05-02 | In 05-02: if `getByIds` returns fewer hits than requested slice, throw `ContextError` (e.g. `chunks_missing`) — no silent partial window |
| **MEDIUM** | **Collection resolution inconsistency** — 05-02 uses `options?.collection ?? doc.collection ?? defaultCollection` but SearchService only uses `options?.collection ?? defaultCollection` | 05-02 | Document intentional divergence in SUMMARY or align with SearchService; multi-collection is deferred but doc.collection exists on registry |
| **MEDIUM** | **CLI / ingest path won't see admin settings changes** if CLI uses separate `initSettingsStore` without web PATCH — only affects operators who change limits via UI then use CLI-only workflows | 05-03 | Accept for v1.1; note in 05-03 checkpoint that MCP Phase 6 must share backend SQLite path |
| **MEDIUM** | **05-01 at 10 files** — high blast radius for Wave 1; failure blocks entire phase | 05-01 | Acceptable but execute 05-01 tasks sequentially; don't parallelize within plan |
| **MEDIUM** | **Grep acceptance criteria** — e.g. `grep -c 'readAround'` passes if method is stubbed | all | Rely on `<verify>` automated test commands as primary gate; treat grep as smoke only |
| **LOW** | **Center-only exceeds char cap (Test 6)** — returns full center with `truncated: true`; may still exceed MCP client limits in Phase 6 | 05-02 | Phase 6 planner should add hard per-chunk cap or split center text when registering MCP tool |
| **LOW** | **05-03 Task 2 lacks `<behavior>` block** — inconsistent with TDD tasks | 05-03 | Add behavior bullets for fetch/save/validation (cosmetic) |
| **LOW** | **RESEARCH Open Questions not marked RESOLVED** | research | Mark resolved before execute to avoid executor confusion |

### Suggestions

1. **05-02 action:** Add explicit handling when `getByIds` count < expected slice length → structured error, no partial chunks (extends CORE-02 spirit).

2. **05-01 action:** In `getByIds`, if Chroma returns unknown ID in batch, omit from result but let ContextService detect mismatch vs expected slice length.

3. **05-03 action:** Add backend test: after PATCH context settings, instantiate fresh `ContextService` and assert `getContextConfig()` reflects new values (proves D-13 without manual UAT only).

4. **05-03 action:** Export `settingsStore` on `AppServices` — already planned; ensure MCP server Phase 6 reuses same pattern as backend `services.ts`.

5. **Env sync:** Document that `.env` defaults only seed on first boot; changing `.env` after DB exists does NOT update SQLite — operators must use Web 设置 or manual SQL.

6. **Phase 6 handoff:** Add to 05-03 SUMMARY a "Phase 6 prerequisites" list: ContextService exported, settingsStore accessible, error codes stable.

### Risk Assessment

**Overall: MEDIUM**

Justification: Core algorithms and patterns are well-specified with strong test plans. Risks concentrate on integration boundaries (Chroma drift, MCP wiring deferred to Phase 6, collection resolution) rather than fundamental design flaws. SQLite migration is the highest implementation risk — mitigated by explicit ALTER tests in 05-01.

---

## External CLI Status

| Reviewer | Status |
|----------|--------|
| Gemini | not installed |
| Claude CLI | not installed |
| Codex | not installed |
| OpenCode | not installed |
| Qwen | not installed |
| Cursor agent | CLI lacks `agent` subcommand |
| Ollama / LM Studio | not running |

To enable true cross-AI review:

```powershell
# Example: install Gemini CLI
# https://github.com/google-gemini/gemini-cli

# Example: install Codex CLI
# https://github.com/openai/codex

/gsd-review --phase 5 --all
```

---

## Consensus Summary

*(Single reviewer — consensus = orchestrator findings above)*

### Agreed Strengths

- Strong traceability from CONTEXT.md decisions to plan tasks
- CORE-02 fail-fast validation before Chroma fetch
- Three-wave dependency graph is acyclic and logical
- Admin settings grouped UI matches user discuss-phase requirement

### Agreed Concerns (priority order)

1. Chroma/registry drift → partial chunk responses need explicit error policy
2. MCP server wiring deferred to Phase 6 — must not be forgotten
3. Grep-based acceptance criteria are weak; automated tests are the real gate

### Divergent Views

None — only one reviewer available.

### Recommended Actions Before Execute

| Priority | Action |
|----------|--------|
| Optional | `/gsd-plan-phase 5 --reviews` after installing external CLI |
| Optional | Patch 05-02 to add missing-chunk error handling (can also fix during execute) |
| Proceed | `/gsd-execute-phase 5` if findings acceptable |
