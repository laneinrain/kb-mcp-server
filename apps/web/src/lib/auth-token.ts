const STORAGE_KEY = "kb_access_token";
const USER_ID_KEY = "kb_user_id";

export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

export function hasAccessToken(): boolean {
  return Boolean(getAccessToken());
}

export function getCurrentUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function setCurrentUserId(userId: string): void {
  localStorage.setItem(USER_ID_KEY, userId);
}
