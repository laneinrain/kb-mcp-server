export interface AuthUser {
  id: string;
  employeeId: string;
  email: string | null;
  authSource: "cas" | "local" | "system";
  createdAt: string;
}

export interface LoginInput {
  employeeId: string;
  password: string;
}

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
  validateAccessToken(token: string): Promise<AuthUser>;
  getUserById(id: string): Promise<AuthUser | null>;
}
