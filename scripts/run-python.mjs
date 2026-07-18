import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = process.platform === "win32"
  ? [path.join(root, ".venv", "Scripts", "python.exe"), "py", "python"]
  : [path.join(root, ".venv", "bin", "python"), "python3", "python"];

const selected = candidates.find((candidate) => candidate === "py" || candidate === "python" || candidate === "python3" || existsSync(candidate));
if (!selected) {
  console.error("Python was not found. Run npm run ai:install first.");
  process.exit(1);
}

const prefix = selected === "py" ? ["-3"] : [];
const child = spawn(selected, [...prefix, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PYTHONPATH: path.join(root, "apps", "ai-service") }
});
child.on("exit", (code) => process.exit(code ?? 1));
