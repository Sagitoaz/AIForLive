import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? process.execPath : "npm";
const npmPrefix = process.platform === "win32"
  ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")]
  : [];
const venvPython = process.platform === "win32"
  ? path.join(root, ".venv", "Scripts", "python.exe")
  : path.join(root, ".venv", "bin", "python");
const python = existsSync(venvPython) ? venvPython : process.platform === "win32" ? "python" : "python3";
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required; verification does not use a local or in-memory database fallback.");
}
const started = new Date();
const results = [];

function command(label, args) {
  console.log(`\n=== ${label} ===`);
  const start = performance.now();
  const result = spawnSync(npm, [...npmPrefix, ...args], { cwd: root, encoding: "utf8", stdio: "pipe", env: process.env });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? `\n${result.error.stack ?? result.error.message}` : ""}`;
  process.stdout.write(output);
  results.push({ label, ok: result.status === 0, durationMs: Math.round(performance.now() - start), output: output.trim().slice(-3_000) });
  return result.status === 0;
}

function countFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    if (["node_modules", ".next", "dist", ".venv", "coverage", ".git", "__pycache__", ".pytest_cache", ".ruff_cache"].includes(entry.name)) return total;
    const target = path.join(directory, entry.name);
    return total + (entry.isDirectory() ? countFiles(target) : 1);
  }, 0);
}

command("Node lint", ["run", "lint:node"]);
command("TypeScript typecheck", ["run", "typecheck"]);
command("Prisma schema validation", ["exec", "--", "prisma", "validate", "--schema", "prisma/schema.prisma"]);
command("Node unit tests", ["run", "test"]);
if (process.env.E2E_API_URL) {
  command("End-to-end workflow tests", ["run", "test:e2e"]);
} else {
  results.push({
    label: "End-to-end workflow tests",
    ok: false,
    durationMs: 0,
    output: "E2E_API_URL is required; verify must not report a skipped live test as PASS."
  });
}
command("Python lint", ["run", "ai:lint"]);
command("Python unit tests", ["run", "ai:test"]);
command("Synthetic data validation", ["run", "validate:synthetic"]);
command("Model evaluation check", ["run", "ai:evaluate"]);
command("Asset validation", ["run", "validate:assets"]);
const artifact = path.join(root, "apps", "ai-service", "ml", "artifacts", "next_attempt_model.joblib");
results.push({ label: "Model artifact", ok: existsSync(artifact) && statSync(artifact).size > 0, durationMs: 0, output: existsSync(artifact) ? `${statSync(artifact).size} bytes` : "missing" });
command("Production build", ["run", "build"]);

const manifest = JSON.parse(readFileSync(path.join(root, "apps", "web", "public", "assets", "asset-manifest.json"), "utf8"));
const version = (binary, args) => {
  const result = spawnSync(binary, args, { cwd: root, encoding: "utf8", env: process.env });
  return `${result.stdout ?? result.stderr ?? result.error?.message ?? "unavailable"}`.trim();
};
const failed = results.filter((result) => !result.ok);
const table = results.map((result) => `| ${result.label} | ${result.ok ? "PASS" : "FAIL"} | ${result.durationMs} ms |`).join("\n");
const report = `# Build verification\n\n- Date: ${new Date().toISOString()}\n- Node: ${process.version}\n- npm: ${version(npm, [...npmPrefix, "--version"])}\n- Python: ${version(python, ["--version"])}\n- Total source/artifact files (dependencies excluded): ${countFiles(root)}\n- Total custom icons: ${manifest.filter((item) => item.category === "icons").length}\n- Total SVG assets: ${manifest.length}\n- Model artifact: ${results.find((item) => item.label === "Model artifact")?.output}\n- ZIP size: pending package verification\n- Overall: ${failed.length ? "FAILED" : "PASSED"}\n\n## Verification matrix\n\n| Check | Result | Duration |\n| --- | --- | ---: |\n${table}\n\n## Model result\n\nThe next-attempt artifact uses a student-group split on synthetic data. See \`apps/ai-service/ml/artifacts/evaluation.json\` and \`docs/model-card.md\`.\n\n## Known limitations\n\n- The source gate validates Prisma and the production build; use smoke-product.ps1 to exercise the live Supabase runtime.\n- Model metrics are from synthetic data and do not establish real educational effectiveness.\n- Live LLM/TTS calls require deployment credentials and quota; LocalTemplateProvider keeps the reviewed authoring workflow available without a paid dependency.\n\nVerification started at ${started.toISOString()} and finished at ${new Date().toISOString()}.\n`;
writeFileSync(path.join(root, "docs", "build-verification.generated.md"), report, "utf8");
if (failed.length) {
  console.error(`\nVerification failed: ${failed.map((item) => item.label).join(", ")}`);
  process.exit(1);
}
console.log("\nAll verification checks passed.");
