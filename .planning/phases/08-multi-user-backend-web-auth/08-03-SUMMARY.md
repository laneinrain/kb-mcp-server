# 08-03 Summary

**Status:** Complete  
**Plan:** Web JWT-only + logout + CLI guard

## Delivered

- Removed `ApiKeyModal` and sessionStorage API key flow from Web
- `api/client.ts`: JWT-only Bearer; 401 clears token and redirects to `/login`
- `AppShell`: header **退出登录** button
- `DocumentTable`: hides delete for docs not owned by current user (shared legacy read-only)
- CLI `runIngest` guard when `USER_AUTH_ENABLED && !AUTH_ENABLED`
- README + `packages/auth/README.md` auth matrix

## Verification

- `pnpm --filter @kb/web build` — pass
- `pnpm --filter @kb/cli test` — pass

## Deferred

- WEB-02 user registration page (JIT login only)
