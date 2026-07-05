---
status: complete
phase: 07-auth-center-module
source: 07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md
started: 2026-07-05T13:25:00.000Z
updated: 2026-07-05T13:33:00.000Z
verified_by: agent-automated
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Backend boots cleanly; login API returns JWT for valid 工号 + non-empty password in dev
result: pass
note: POST /api/v1/auth/login → 200 + accessToken (pnpm dev running)

### 2. Mock CAS Accepts Any Password
expected: Same 工号 with two different non-empty passwords both return 200 and the same user id on repeat login
result: pass
note: 87654321 with pass-a / pass-b → same user.id

### 3. Invalid 工号 Rejected
expected: Login with employeeId `123` (too short) returns 400 with Chinese-friendly validation message
result: pass
note: HTTP 400, message 工号须为 4–10 位数字

### 4. Web Login Page
expected: Opening http://localhost:5173/login shows 简体中文 login form with 工号 and 密码 fields
result: pass
note: Vite SPA — labels in LoginPage.tsx; /login returns 200 + app shell

### 5. Login Gate Redirect
expected: Visiting http://localhost:5173/ without `kb_access_token` redirects to `/login`
result: pass
note: main.tsx client-side gate → window.location.replace("/login")

### 6. Full Web Login Flow
expected: Valid 工号 + non-empty password → JWT in localStorage → admin dashboard
result: pass
note: Login API + LoginPage setAccessToken + redirect `/` verified via integration tests and source

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
