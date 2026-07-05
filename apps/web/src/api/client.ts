import { ApiError, type ApiErrorBody } from "../types.js";
import { clearAccessToken, getAccessToken } from "../lib/auth-token.js";

async function parseError(response: Response): Promise<ApiErrorBody> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error && body.message) {
      return body;
    }
  } catch {
    // fall through
  }
  return {
    error: "http_error",
    message: `HTTP ${response.status} ${response.statusText}`,
  };
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(0, {
      error: "network_error",
      message: "无法连接 API，请先启动后端（pnpm dev）并刷新页面。",
    });
  }

  if (response.status === 401) {
    clearAccessToken();
    window.location.replace("/login");
    throw new ApiError(401, {
      error: "unauthorized",
      message: "登录已过期，请重新登录",
    });
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
