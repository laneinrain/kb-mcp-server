const STORAGE_KEY = "kb_access_token";
const USER_ID_KEY = "kb_user_id";
const USER_ROLE_KEY = "kb_user_role";
const EMPLOYEE_ID_KEY = "kb_employee_id";

export type UserRole = "admin" | "user";

export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(EMPLOYEE_ID_KEY);
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

export function getCurrentUserRole(): UserRole {
  const role = localStorage.getItem(USER_ROLE_KEY);
  return role === "admin" ? "admin" : "user";
}

export function setCurrentUserRole(role: UserRole): void {
  localStorage.setItem(USER_ROLE_KEY, role);
}

export function getCurrentEmployeeId(): string | null {
  return localStorage.getItem(EMPLOYEE_ID_KEY);
}

export function setCurrentEmployeeId(employeeId: string): void {
  localStorage.setItem(EMPLOYEE_ID_KEY, employeeId);
}

export function isAdminUser(): boolean {
  return getCurrentUserRole() === "admin";
}
