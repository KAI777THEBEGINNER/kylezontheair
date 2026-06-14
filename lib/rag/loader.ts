import fs from "fs";
import path from "path";

export function loadKnowledgeBase(dir: string = "knowledge"): string {
  const basePath = path.join(process.cwd(), dir);

  if (!fs.existsSync(basePath)) {
    return "";
  }

  const files = fs
    .readdirSync(basePath)
    .filter((f) => f.endsWith(".md"))
    .sort();

  return files.map((f) => fs.readFileSync(path.join(basePath, f), "utf-8")).join("\n\n");
}
