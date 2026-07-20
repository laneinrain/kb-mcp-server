# Vendored concurrently

**Why:** Private-network `pnpm install` may fail to fetch `concurrently` from the public registry. This tarball is committed so installs resolve from the repo.

**File:** `concurrently-10.0.1.tgz` (exact version pinned in root `package.json` via `file:`).

**Refresh (online machine):**

```bash
npm pack concurrently@10.0.1 --pack-destination vendor/concurrently
# then commit the new .tgz and update package.json / pnpm-lock.yaml
```

Transitive deps (`chalk`, `rxjs`, `yargs`, …) still come from the registry / your private mirror.
