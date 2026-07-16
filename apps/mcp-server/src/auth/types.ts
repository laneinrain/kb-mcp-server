import type { AuthUser } from "@kb/auth";

export type McpAuthMode = "user" | "service" | "global";

export interface McpCallerContext {
  authMode: McpAuthMode;
  authUser?: AuthUser;
  /** undefined = no ACL filter (global corpus) */
  allowedDocumentIds?: ReadonlySet<string>;
}
