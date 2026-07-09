import { AuthConflictError, AuthValidationError } from "./errors.js";
import {
  ADMIN_EMPLOYEE_ID,
  isReservedEmployeeId,
  SYSTEM_EMPLOYEE_ID,
} from "./constants.js";
import { validateEmployeeId } from "./employee-id.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken, verifyAccessToken } from "./jwt.js";
import type {
  AuthProvider,
  AuthUser,
  LoginInput,
  LoginResult,
  RegisterInput,
} from "./types.js";
import { openAuthDatabase, UserStore } from "./user-store.js";

const MIN_REGISTER_PASSWORD_LENGTH = 8;

export interface MockCasAuthProviderOptions {
  dbPath: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
}

export class MockCasAuthProvider implements AuthProvider {
  private readonly store: UserStore;
  private readonly db: ReturnType<typeof openAuthDatabase>;
  private readonly jwtSecret: string;
  private readonly jwtExpiresInSeconds: number;

  constructor(options: MockCasAuthProviderOptions) {
    this.db = openAuthDatabase(options.dbPath);
    this.store = new UserStore(this.db);
    this.jwtSecret = options.jwtSecret;
    this.jwtExpiresInSeconds = options.jwtExpiresInSeconds;
  }

  close(): void {
    this.db.close();
  }

  async register(input: RegisterInput): Promise<AuthUser> {
    try {
      validateEmployeeId(input.employeeId);
    } catch (error) {
      throw new AuthValidationError(
        error instanceof Error ? error.message : "Invalid employee ID",
      );
    }
    if (input.password.length < MIN_REGISTER_PASSWORD_LENGTH) {
      throw new AuthValidationError("密码至少 8 位");
    }
    if (isReservedEmployeeId(input.employeeId)) {
      throw new AuthValidationError("该工号不可注册");
    }

    const passwordHash = await hashPassword(input.password);
    return this.store.registerLocalUser({
      employeeId: input.employeeId,
      passwordHash,
    });
  }

  async login(input: LoginInput): Promise<LoginResult> {
    try {
      validateEmployeeId(input.employeeId);
    } catch (error) {
      throw new AuthValidationError(
        error instanceof Error ? error.message : "Invalid employee ID",
      );
    }
    if (!input.password.trim()) {
      throw new AuthValidationError("密码不能为空");
    }
    if (input.employeeId === SYSTEM_EMPLOYEE_ID) {
      throw new AuthValidationError("系统账号不可登录");
    }

    const existing = this.store.findRowByEmployeeId(input.employeeId);

    if (existing?.auth_source === "system") {
      throw new AuthValidationError("系统账号不可登录");
    }

    let user: AuthUser;

    if (existing?.auth_source === "local") {
      if (!existing.password_hash) {
        throw new AuthValidationError("工号或密码错误");
      }
      const valid = await verifyPassword(input.password, existing.password_hash);
      if (!valid) {
        throw new AuthValidationError("工号或密码错误");
      }
      user = this.store.findByEmployeeId(input.employeeId)!;
    } else if (existing?.auth_source === "cas") {
      user = this.store.findByEmployeeId(input.employeeId)!;
    } else if (input.employeeId === ADMIN_EMPLOYEE_ID) {
      throw new AuthValidationError("工号或密码错误");
    } else {
      user = this.store.upsertCasUser(input.employeeId);
    }

    user = this.store.recordLastLogin(user.id) ?? user;

    const accessToken = await signAccessToken({
      userId: user.id,
      employeeId: user.employeeId,
      role: user.role,
      secret: this.jwtSecret,
      expiresInSeconds: this.jwtExpiresInSeconds,
    });

    return {
      user,
      tokens: {
        accessToken,
        tokenType: "Bearer",
        expiresIn: this.jwtExpiresInSeconds,
      },
    };
  }

  async validateAccessToken(token: string): Promise<AuthUser> {
    const payload = await verifyAccessToken(token, this.jwtSecret);
    const user = this.store.findById(payload.sub);
    if (!user) {
      throw new Error("Invalid token");
    }
    return user;
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    return this.store.findById(id) ?? null;
  }
}
