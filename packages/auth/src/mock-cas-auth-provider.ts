import { AuthValidationError } from "./errors.js";
import { SYSTEM_EMPLOYEE_ID } from "./constants.js";
import { validateEmployeeId } from "./employee-id.js";
import { signAccessToken, verifyAccessToken } from "./jwt.js";
import type { AuthProvider, AuthUser, LoginInput, LoginResult } from "./types.js";
import { openAuthDatabase, UserStore } from "./user-store.js";

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

    const user = this.store.upsertCasUser(input.employeeId);
    const accessToken = await signAccessToken({
      userId: user.id,
      employeeId: user.employeeId,
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
