# @kb/auth



Independent authentication center for kb-mcp-server. Production deployments swap **MockCasAuthProvider** for **CasAuthProvider** (company unified CAS) without changing backend routes or the Web login page.



## AuthProvider contract



```typescript

interface AuthProvider {

  login(input: { employeeId: string; password: string }): Promise<LoginResult>;

  validateAccessToken(token: string): Promise<AuthUser>;

  getUserById(id: string): Promise<AuthUser | null>;

}

```



## Default: MockCasAuthProvider



When `CAS_MOCK=true` (scaffold default):

- **JIT CAS users** (`auth_source=cas`): login with valid 工号 + any non-empty password; user created on first login.
- **Local users** (`auth_source=local`): bcrypt password verification (register + admin).
- **Admin bootstrap**: 工号 `00000` / password `admin123` created on backend startup when `CAS_MOCK=true` (**scaffold only — do not expose to public networks**).
- **`POST /api/v1/auth/register`**: create local user (min 8 char password); disabled when `CAS_MOCK=false`.

JWT includes `role: admin | user`.



In local `pnpm dev`, `USER_AUTH_ENABLED` and a dev `JWT_SECRET` are applied automatically unless you set `USER_AUTH_ENABLED=false`.



## Production: CasAuthProvider



Set:



```env

USER_AUTH_ENABLED=true

JWT_SECRET=... # min 32 chars

CAS_MOCK=false

CAS_SERVER_URL=https://your-company-cas.example/cas

AUTH_PROVIDER=cas

```



Implement real CAS ticket/password validation inside `CasAuthProvider` (`packages/auth/src/cas-auth-provider.ts`). The Web login form and `POST /api/v1/auth/login` stay unchanged.



## Environment variables



| Variable | Default | Notes |

|----------|---------|-------|

| `USER_AUTH_ENABLED` | `false` | Enables auth routes + provider |

| `JWT_SECRET` | — | Required when user auth enabled |

| `JWT_EXPIRES_IN` | `604800` | Access token TTL (seconds) |

| `AUTH_SQLITE_PATH` | `./data/sqlite/auth.db` | User store |

| `AUTH_PROVIDER` | `cas` | `local` reserved for dev register |

| `CAS_MOCK` | `true` | Mock CAS success in scaffold |

| `CAS_SERVER_URL` | — | Required when `CAS_MOCK=false` |



Separate from legacy `AUTH_ENABLED` / `API_KEY` (service/API-key mode).



## Auth matrix (Phase 8)



| Surface | Credential | Document scope |

|---------|------------|----------------|

| Web admin | JWT from login | Own docs + system legacy shared docs |

| CLI / automation | `AUTH_ENABLED` + `API_KEY` | Global service access |

| MCP HTTP | Unchanged this phase | Search tools only |



When `USER_AUTH_ENABLED=true`, CLI ingest requires `AUTH_ENABLED=true` and `API_KEY` (REST path). Per-user CLI login is deferred. Mock-mode register + admin console ship in v1.3 Phase 10–12.



## Backend integration

```typescript
import { createAuthProvider } from "@kb/auth";
// apps/backend/src/auth.ts exports createProtectedRouteOpts

await registerBearerAuthIfEnabled(app, config);
const routeOpts = createProtectedRouteOpts(config, app, authProvider);
```

Protected routes accept **JWT** (user-scoped) or **API_KEY** (service-scoped) when both flags are enabled.



## System user



Legacy documents are backfilled to a system user (`employee_id = 00000000`). All logged-in users can read these; only the document owner (or service API key) can delete.



## Swap checklist (production CAS)



1. Implement `CasAuthProvider.login` against company CAS API.

2. Set `CAS_MOCK=false` and `CAS_SERVER_URL`.

3. Keep login page (工号 + 密码) unchanged.

4. Optionally disable open register — users JIT on first CAS login.

