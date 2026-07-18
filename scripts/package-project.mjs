import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import archiver from "archiver";
import AdmZip from "adm-zip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.resolve(root, "..", "EduRecall-AI-source.zip");
const checkDirectory = path.resolve(root, "..", ".package-check-edurecall");
const excluded = ["node_modules", ".next", "dist", "coverage", ".git", ".env", ".venv", "venv", "__pycache__", ".pytest_cache", ".ruff_cache", "logs"];

function createZip() {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.glob("**/*", {
      cwd: root,
      dot: true,
      ignore: [
        "node_modules/**", "**/node_modules/**", ".next/**", "**/.next/**", "dist/**", "**/dist/**",
        "coverage/**", "**/coverage/**", ".git/**", "**/.env", "**/.env.*", ".venv/**", "venv/**",
        "**/__pycache__/**", "**/.pytest_cache/**", "**/.ruff_cache/**", "**/*.pyc", "**/*.log", "logs/**", "uploads/tmp/**"
      ]
    }, { prefix: "EduRecall-AI" });
    archive.file(path.join(root, ".env.example"), { name: "EduRecall-AI/.env.example" });
    archive.file(path.join(root, ".env.supabase.example"), { name: "EduRecall-AI/.env.supabase.example" });
    void archive.finalize();
  });
}

await createZip();
rmSync(checkDirectory, { recursive: true, force: true });
mkdirSync(checkDirectory, { recursive: true });
const zip = new AdmZip(outputPath);
zip.extractAllTo(checkDirectory, true);
const extracted = path.join(checkDirectory, "EduRecall-AI");
const required = [
  "package.json", "README.md", ".env.example", ".env.supabase.example", "docker-compose.yml", "prisma/schema.prisma", "apps/ai-service/pyproject.toml",
  "apps/ai-service/requirements.txt", "apps/ai-service/ml/artifacts/next_attempt_model.joblib",
  "apps/web/public/assets/asset-manifest.json", "scripts/setup.ps1", "docs/build-verification.md"
];
const problems = required.filter((file) => !existsSync(path.join(extracted, file))).map((file) => `Missing ${file}`);
const entryNames = zip.getEntries().map((entry) => entry.entryName);
for (const name of entryNames) {
  if (excluded.some((segment) => name.split("/").includes(segment))) problems.push(`Excluded path present: ${name}`);
  const allowedEnvironmentExample = name.endsWith("/.env.example") || name.endsWith("/.env.supabase.example");
  if (/(^|\/)\.env(?:$|\.)/.test(name) && !allowedEnvironmentExample) problems.push(`Secret env file present: ${name}`);
}
const manifest = JSON.parse(readFileSync(path.join(extracted, "apps", "web", "public", "assets", "asset-manifest.json"), "utf8"));
if (manifest.length < 234) problems.push(`Asset manifest unexpectedly small: ${manifest.length}`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
let report = readFileSync(path.join(root, "docs", "build-verification.md"), "utf8");
const firstSize = statSync(outputPath).size;
report = report.replace(/- ZIP size: .*/, `- ZIP size: ${(firstSize / 1024 / 1024).toFixed(2)} MiB`);
writeFileSync(path.join(root, "docs", "build-verification.md"), report, "utf8");
await createZip();
rmSync(checkDirectory, { recursive: true, force: true });
console.log(JSON.stringify({ outputPath, sizeBytes: statSync(outputPath).size, entries: entryNames.length, assets: manifest.length, verified: true }, null, 2));
