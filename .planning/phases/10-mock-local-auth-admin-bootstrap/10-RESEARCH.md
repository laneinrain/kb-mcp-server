# Phase 10: Mock Local Auth & Admin Bootstrap - Research

**Researched:** 2026-07-07

## bcrypt Library Choice

| Option | Pros | Cons |
|--------|------|------|
| **bcryptjs** | Pure JS, no native rebuild on Node upgrades | Slower than native bcrypt |
| bcrypt | Faster | Native addon — same pain as better-sqlite3 on Node bumps |

**Decision:** `bcryptjs@^3.0.2` — matches scaffold simplicity; auth is low-QPS.

## Schema Migration Pattern

Current `openAuthDatabase` runs full `schema.sql` via `db.exec`. For additive columns:

```sql
-- run idempotently after schema.sql
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
```

SQLite `ALTER TABLE ADD COLUMN` is idempotent-safe when wrapped in try/catch or `PRAGMA table_info` check.

## JWT Role Claim

Extend existing payload:

```typescript
{ sub, employeeId, role: "admin" | "user" }
```

`verifyAccessToken` returns role; fallback `user` if missing (backward compat for old tokens during dev).

## AuthProvider Interface Extension

```typescript
interface AuthProvider {
  login(...): Promise<LoginResult>;
  register?(input: LoginInput): Promise<AuthUser>;  // optional — only mock
  validateAccessToken(...): Promise<AuthUser>;
  getUserById(...): Promise<AuthUser | null>;
}
```

Register returns user only (no auto-login token) — client calls login after register, or register route returns 201 + user.

## Reserved ID Collision

| ID | Length | Pattern match | Reserved for |
|----|--------|---------------|--------------|
| `00000` | 5 | ✅ `^\d{4,10}$` | Admin |
| `00000000` | 8 | ✅ | System |

Both pass `validateEmployeeId` — explicit block list required in register/login.

## Test Strategy

- Unit: `@kb/auth` — register, local login bcrypt, admin bootstrap, reserved IDs, JWT role
- Integration: `apps/backend` — register route 404 when CAS_MOCK=false, 201 when mock, duplicate 409

## Risks

| Risk | Mitigation |
|------|------------|
| Admin password in source | Document scaffold-only; constant in `constants.ts` with comment |
| Old JWT without role | Default `user` on verify; re-login refreshes |
| bcrypt on every login | Acceptable for admin console scale |
