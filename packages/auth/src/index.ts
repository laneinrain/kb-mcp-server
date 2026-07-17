export type {
  AuthProvider,
  AuthTokens,
  AuthUser,
  LoginInput,
  LoginResult,
  RegisterInput,
  UserRole,
} from "./types.js";
export { AuthValidationError, AuthConflictError } from "./errors.js";
export {
  SYSTEM_AUTH_SOURCE,
  SYSTEM_EMPLOYEE_ID,
  ADMIN_EMPLOYEE_ID,
  ADMIN_DEFAULT_PASSWORD,
  RESERVED_EMPLOYEE_IDS,
  isReservedEmployeeId,
} from "./constants.js";
export { EMPLOYEE_ID_PATTERN, validateEmployeeId } from "./employee-id.js";
export { openAuthDatabase, UserStore } from "./user-store.js";
export { hashPassword, verifyPassword } from "./password.js";
export { signAccessToken, verifyAccessToken } from "./jwt.js";
export { MockCasAuthProvider } from "./mock-cas-auth-provider.js";
export { CasAuthProvider } from "./cas-auth-provider.js";
export { createAuthProvider } from "./factory.js";
export { createJwtPreHandler } from "./fastify.js";
export {
  BearerAuthError,
  resolveBearerToken,
  type BearerAuthMode,
  type BearerAuthResult,
  type ResolveBearerTokenDeps,
} from "./bearer-resolver.js";
