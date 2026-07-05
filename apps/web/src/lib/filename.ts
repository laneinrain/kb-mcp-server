/** Strip `{uuid}-` prefix from legacy upload temp filenames. */
const UPLOAD_TEMP_PREFIX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i;

export function displayFilename(stored: string): string {
  const match = stored.match(UPLOAD_TEMP_PREFIX);
  return match?.[1] ?? stored;
}
