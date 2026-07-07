export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}

export class AuthConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConflictError";
  }
}
