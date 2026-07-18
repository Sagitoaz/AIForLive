import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = path.join(root, "apps", "ai-service", "data", "synthetic");
const required = {
  "student_profiles.csv": 20,
  "concepts.csv": 8,
  "exercises.csv": 48,
  "attempts.csv": 400,
  "misconceptions.csv": 10,
  "concept_ground_truth.csv": 160,
  "learning_events.jsonl": 400
};
const errors = [];
for (const [name, expected] of Object.entries(required)) {
  const text = readFileSync(path.join(data, name), "utf8").trim();
  const lines = text.split(/\r?\n/);
  const actual = name.endsWith(".csv") ? lines.length - 1 : lines.length;
  if (actual !== expected) errors.push(`${name}: expected ${expected} rows, found ${actual}`);
  if (!text.includes("SYNTHETIC DATA") && name !== "learning_events.jsonl") errors.push(`${name}: data notice missing`);
  if (name === "learning_events.jsonl" && !text.includes('"synthetic": true')) errors.push(`${name}: synthetic marker missing`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Synthetic data validation passed: 20 students, 8 concepts, 48 exercises, 400 attempts/events.");
