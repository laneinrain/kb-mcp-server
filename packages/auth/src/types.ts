export type UserRole = "admin" | "user";

export interface AuthUser {
  id: string;
  employeeId: string;
  email: string | null;
  authSource: "cas" | "local" | "system";
  role: UserRole;
  createdAt: string;
}

export interface LoginInput {
  employeeId: string;
  password: string;
}

export type RegisterInput = LoginInput;

export interface AuthTokens {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface LoginResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface AuthProvider {
  login(input: LoginInput): Promise<LoginResult>;
  register?(input: RegisterInput): Promise<AuthUser>;
  validateAccessToken(token: string): Promise<AuthUser>;
  getUserById(id: string): Promise<AuthUser | null>;
}
