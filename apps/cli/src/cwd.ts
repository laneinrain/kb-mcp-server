import { fileURLToPath } from "node:url";
import { findMonorepoRoot } from "@kb/config";

/** Prefer INIT_CWD (pnpm) so relative ingest paths resolve from repo root. */
export function restoreInvokerCwd(): void {
  const initCwd = process.env.INIT_CWD;
  if (initCwd) {
    process.chdir(initCwd);
    return;
  }
  process.chdir(findMonorepoRoot(process.cwd(), fileURLToPath(import.meta.url)));
}
