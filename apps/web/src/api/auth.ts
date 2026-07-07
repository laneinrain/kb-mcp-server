import { apiRequest } from "./client.js";
import type { UserRole } from "../lib/auth-token.js";

export interface AuthUser {
  id: string;
  employeeId: string;
  email: string | null;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
}

export interface RegisterResponse {
  user: AuthUser;
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

export async function register(
  employeeId: string,
  password: string,
): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, password }),
  });
}

/** Returns true when mock-mode register endpoint is enabled (not 404). */
export async function isRegisterAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: "", password: "" }),
    });
    return response.status !== 404;
  } catch {
    return false;
  }
}
