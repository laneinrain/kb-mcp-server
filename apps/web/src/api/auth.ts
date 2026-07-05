import { apiRequest } from "./client.js";

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: {
    id: string;
    employeeId: string;
    email: string | null;
  };
}

export async function login(
  employeeId: string,
  password: string,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, password }),
  });
}
