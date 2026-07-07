export const SYSTEM_EMPLOYEE_ID = "00000000";
export const SYSTEM_AUTH_SOURCE = "system";

/** Scaffold-only admin account when CAS_MOCK=true — do not expose to public networks. */
export const ADMIN_EMPLOYEE_ID = "00000";
export const ADMIN_DEFAULT_PASSWORD = "admin123";

export const RESERVED_EMPLOYEE_IDS = new Set([
  ADMIN_EMPLOYEE_ID,
  SYSTEM_EMPLOYEE_ID,
]);

export function isReservedEmployeeId(employeeId: string): boolean {
  return RESERVED_EMPLOYEE_IDS.has(employeeId);
}
