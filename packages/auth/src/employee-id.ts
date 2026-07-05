export const EMPLOYEE_ID_PATTERN = /^\d{4,10}$/;

export function validateEmployeeId(employeeId: string): void {
  if (!EMPLOYEE_ID_PATTERN.test(employeeId)) {
    throw new Error("工号须为 4–10 位数字");
  }
}
