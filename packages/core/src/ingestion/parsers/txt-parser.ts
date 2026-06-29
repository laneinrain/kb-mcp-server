import { readFileSync } from "node:fs";

export async function parseTxt(filePath: string): Promise<string> {
  return readFileSync(filePath, "utf-8");
}
