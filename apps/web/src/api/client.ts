import { ApiError, type ApiErrorBody } from "../types.js";

const STORAGE_KEY = "kb_api_key";

type UnauthorizedHandler = (invalid: boolean) => Promise<string | null>;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export function getApiKey(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setApiKey(key: string): void {
  sessionStorage.setItem(STORAGE_KEY, key);
}

export function clearApiKey(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

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

function authHeaders(): Record<string, string> {
  const key = getApiKey();
  if (key) {
    return { Authorization: `Bearer ${key}` };
  }
  return {};
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(authHeaders())) {
    headers.set(name, value);
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

  if (response.status === 401 && unauthorizedHandler) {
    if (retried) {
      clearApiKey();
    }
    const key = await unauthorizedHandler(retried);
    if (key) {
      setApiKey(key);
      return apiRequest<T>(path, init, true);
    }
    throw new ApiError(401, {
      error: "unauthorized",
      message: "需要 API 密钥",
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
