import { readFileSync } from "node:fs";
import matter from "gray-matter";

export async function parseMd(filePath: string): Promise<string> {
  const raw = readFileSync(filePath, "utf-8");
  return matter(raw).content;
}
