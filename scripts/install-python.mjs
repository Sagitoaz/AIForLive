import { chmodSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const venvPython = process.platform === "win32"
  ? path.join(root, ".venv", "Scripts", "python.exe")
  : path.join(root, ".venv", "bin", "python");
const pythonCandidates = process.platform === "win32"
  ? [{ command: "python", prefix: [] }, { command: "py", prefix: ["-3"] }]
  : [{ command: "python3", prefix: [] }, { command: "python", prefix: [] }];
function isSupportedPython({ command, prefix }) {
  const result = spawnSync(command, [...prefix, "--version"], { encoding: "utf8" });
  if (result.status !== 0) return false;
  const match = `${result.stdout ?? ""}${result.stderr ?? ""}`.match(/Python\s+(\d+)\.(\d+)/i);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 3 || (major === 3 && minor >= 11);
}

const selected = pythonCandidates.find(isSupportedPython);
if (!selected) {
  console.error("Python 3.11 or newer was not found.");
  process.exit(1);
}

if (!existsSync(venvPython)) {
  const result = spawnSync(selected.command, [...selected.prefix, "-m", "venv", "--copies", ".venv"], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const install = spawnSync(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], { cwd: root, stdio: "inherit" });
if (install.status !== 0) process.exit(install.status ?? 1);
const dependencies = spawnSync(venvPython, ["-m", "pip", "install", "-r", "apps/ai-service/requirements.txt"], { cwd: root, stdio: "inherit" });
if (dependencies.status !== 0) process.exit(dependencies.status ?? 1);

// Some extracted Linux environments do not preserve the executable bit of
// binary wheels. Normal Linux/macOS and Windows installs are unaffected.
if (process.platform !== "win32") {
  const ruffBinary = path.join(root, ".venv", "bin", "ruff");
  if (existsSync(ruffBinary)) chmodSync(ruffBinary, 0o755);
}
