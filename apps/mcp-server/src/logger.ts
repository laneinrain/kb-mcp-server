export function logInfo(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function logError(error: unknown): void {
  const text = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${text}\n`);
}
