import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function includes(source, expected, label) {
  assert.ok(source.includes(expected), `${label} is missing: ${expected}`);
}

const dockerfile = text("Dockerfile.render");
const startScript = text("scripts/start-render.sh");
const requirements = text("apps/ai-service/requirements.render.txt");
const blueprint = text("render.yaml");
const dockerignore = text(".dockerignore");
const packageManifest = JSON.parse(text("package.json"));
const packageLock = JSON.parse(text("package-lock.json"));

assert.equal(packageManifest.packageManager, "npm@10.9.8", "packageManager must match Render's npm version");
assert.equal(packageLock.lockfileVersion, 3, "Render requires an npm lockfile v3");
for (const lockPath of ["node_modules/@emnapi/core", "node_modules/@emnapi/runtime"]) {
  assert.ok(packageLock.packages?.[lockPath], `npm 10 clean install record missing: ${lockPath}`);
}

const renderDependencies = new Set(requirements
  .split(/\r?\n/)
  .map((line) => line.trim().match(/^([A-Za-z0-9_.-]+)/)?.[1]?.toLowerCase())
  .filter(Boolean));
for (const dependency of ["fastapi", "uvicorn", "pydantic", "httpx", "numpy", "scikit-learn", "joblib"]) {
  assert.ok(renderDependencies.has(dependency), `Render Python dependency missing: ${dependency}`);
}

includes(dockerfile, "apps/ai-service/requirements.render.txt", "Dockerfile");
includes(dockerfile, "CMD [\"sh\", \"scripts/start-render.sh\"]", "Dockerfile");
includes(dockerfile, "COPY --from=node-build /app/apps/web/.next/standalone ./", "Dockerfile");
includes(startScript, 'export API_PORT="4000"', "Render supervisor");
includes(startScript, 'export AI_SERVICE_URL="http://127.0.0.1:8001"', "Render supervisor");
includes(startScript, "prisma migrate deploy", "Render supervisor");
includes(startScript, "apps/web/server.js", "Render supervisor");
assert.equal(startScript.includes("\r\n"), false, "Render shell script must use LF line endings");

includes(blueprint, "runtime: docker", "Render Blueprint");
includes(blueprint, "dockerfilePath: ./Dockerfile.render", "Render Blueprint");
includes(blueprint, "healthCheckPath: /backend-api/health", "Render Blueprint");
assert.match(blueprint, /- key: DATABASE_URL\s+sync: false/, "DATABASE_URL must be prompted as a secret");
assert.match(blueprint, /- key: DIRECT_URL\s+sync: false/, "DIRECT_URL must be prompted as a secret");
assert.match(blueprint, /- key: EXTERNAL_LLM_API_KEY\s+sync: false/, "LLM key must be prompted as a secret");
assert.match(blueprint, /- key: JWT_ACCESS_SECRET\s+generateValue: true/, "Access secret must be generated");
assert.match(blueprint, /- key: JWT_REFRESH_SECRET\s+generateValue: true/, "Refresh secret must be generated");
assert.match(blueprint, /- key: DEMO_MODE\s+value: ["']?true["']?/, "Hackathon Blueprint must expose synthetic demo accounts");

for (const staleKey of ["NEXT_PUBLIC_API_URL", "API_INTERNAL_URL", "AI_SERVICE_URL", "API_PORT"]) {
  assert.equal(blueprint.includes(`key: ${staleKey}`), false, `Blueprint must not override ${staleKey}`);
}
assert.match(dockerignore, /^\.env$/m, "Docker context must exclude .env");

console.log("Render deployment contract: OK (npm 10 lock, Docker, Python deps, supervisor, Blueprint, secret boundaries)");
