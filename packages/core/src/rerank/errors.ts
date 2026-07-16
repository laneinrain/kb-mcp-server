export class RerankError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "RerankError";
    this.statusCode = statusCode;
  }
}
