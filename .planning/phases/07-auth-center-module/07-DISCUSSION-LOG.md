# Phase 7: Auth Center Module - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 07-auth-center-module
**Areas discussed:** 工号标识, 注册策略, JWT 会话, 工号格式, 与 API_KEY 并存, 鉴权模块边界

---

## 用户标识（工号）

| Option | Description | Selected |
|--------|-------------|----------|
| 通用 username | 字母数字用户名 | |
| 工号 employeeId | Web 登录填写工号 | ✓ |
| Email 登录 | 邮箱作为登录标识 | |

**User's choice:** 采用工号；Web 后台登录时需要填写工号。
**Notes:** API 字段 `employeeId`，DB `employee_id`，JWT `sub` 仍为内部 UUID。

---

## 工号格式

| Option | Description | Selected |
|--------|-------------|----------|
| 4–20 位字母数字 | 宽松规则 | |
| 4–10 位纯数字 | 常见工号格式 | ✓ |
| 3–32 位字母数字下划线 | 与原计划 username 规则一致 | |

**User's choice:** 4–10 位纯数字（`^\d{4,10}$`）

---

## 注册策略

| Option | Description | Selected |
|--------|-------------|----------|
| 开放注册 | 任意未占用工号可注册 | ✓ |
| 仅首个用户 bootstrap | 首个工号后关闭公开注册 | |
| 开放 + README 生产警告 | 开放注册并文档化生产限制 | |

**User's choice:** 开放注册

---

## JWT 会话

| Option | Description | Selected |
|--------|-------------|----------|
| Access 7 天，无 Refresh | 与现有计划一致 | ✓ |
| Access 24 小时 | 更短会话 | |
| Access + Refresh | 双 token | |

**User's choice:** Access Token 7 天，无 Refresh Token

---

## 与 API_KEY 并存

| Option | Description | Selected |
|--------|-------------|----------|
| USER_AUTH_ENABLED 独立 | 与 AUTH_ENABLED/API_KEY 分离 | ✓ |
| 合并为单一 AUTH 开关 | 简化配置 | |

**User's choice:** 独立开关（继承 RESEARCH/计划默认，讨论确认）

---

## Claude's Discretion

- Auth disabled 时路由返回 404
- README 注明生产环境应对开放注册做网关/IP 限制
- Register 暂不强制 displayName 字段

---

## Deferred Ideas

- Refresh token、管理员创建工号、邮箱登录、register 速率限制 — 后续阶段
