# 07-03 Summary

**Status:** Complete  
**Plan:** Web login page + JWT client

## Delivered

- `LoginPage` — 简体中文 工号 + 密码
- `localStorage` key `kb_access_token`
- Route gate in `main.tsx` → `/login` when unauthenticated (`VITE_USER_AUTH !== 'false'`)
- `api/client.ts` sends Bearer JWT when token present (falls back to API key)

## Verification

- `pnpm --filter @kb/web build` — pass

## Manual UAT

Set in `.env`:

```env
USER_AUTH_ENABLED=true
JWT_SECRET=your_jwt_secret_at_least_32_characters
CAS_MOCK=true
```

Run `pnpm dev`, open web → login with工号 `12345678` + any password.
