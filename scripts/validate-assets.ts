import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

interface AssetRecord {
  name: string;
  category: string;
  path: string;
  format: string;
  dimensions: string;
  usedIn: string[];
  description: string;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = path.join(root, "apps", "web", "public", "assets");
const manifestPath = path.join(assetRoot, "asset-manifest.json");
const parser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: true });

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : Promise.resolve([target]);
  }));
  return nested.flat();
}

async function main(): Promise<void> {
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as AssetRecord[];
const errors: string[] = [];
const seen = new Set<string>();
for (const item of manifest) {
  if (seen.has(item.name)) errors.push(`Duplicate manifest name: ${item.name}`);
  seen.add(item.name);
  if (!item.category || !item.path || !item.dimensions || !item.description || !item.usedIn.length) errors.push(`Incomplete manifest record: ${item.name}`);
  const local = path.join(root, "apps", "web", "public", item.path.replace(/^\/assets\//, "assets/"));
  try {
    const info = await stat(local);
    if (info.size === 0) errors.push(`Empty file: ${item.path}`);
    if (info.size > 250_000) errors.push(`SVG too large: ${item.path}`);
    const source = await readFile(local, "utf8");
    const parsed = parser.parse(source) as Record<string, unknown>;
    if (!parsed.svg) errors.push(`Root element is not svg: ${item.path}`);
    if (!source.includes("viewBox=")) errors.push(`Missing viewBox: ${item.path}`);
    if (/<script\b/i.test(source)) errors.push(`Script found: ${item.path}`);
    if (/(?:href|xlink:href)=["']https?:|url\(\s*https?:/i.test(source)) errors.push(`Remote URL found: ${item.path}`);
  } catch (error) {
    errors.push(`Cannot validate ${item.path}: ${String(error)}`);
  }
}
const actual = (await walk(assetRoot)).filter((file) => file.endsWith(".svg"));
if (actual.length !== manifest.length) errors.push(`Manifest has ${manifest.length} assets but filesystem has ${actual.length} SVG files`);
const minimums: Record<string, number> = { icons: 80, mascot: 12, illustrations: 24, "course-covers": 10, badges: 24, games: 20, avatars: 24, backgrounds: 8, patterns: 12, decorations: 20 };
for (const [category, minimum] of Object.entries(minimums)) {
  const count = manifest.filter((item) => item.category === category).length;
  if (count < minimum) errors.push(`${category}: expected at least ${minimum}, found ${count}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Asset validation passed: ${manifest.length} SVG files, ${manifest.filter((item) => item.category === "icons").length} custom icons.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
