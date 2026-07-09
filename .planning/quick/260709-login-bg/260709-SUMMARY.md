---
status: complete
---

# Quick Task 260709 — Login background image

## Done

- Added `apps/web/public/login_in_backgrand.png` (served at `/login_in_backgrand.png`)
- Login + register pages use full-viewport cover background
- Login card uses frosted glass (`backdrop-filter`) for readable form overlay
- Web build verified — asset copied to `apps/web/dist/`

## Verify

```bash
pnpm --filter @kb/web build
# Open http://127.0.0.1:3000/login after start:prod
```
