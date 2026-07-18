import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(path.join(root, ".env"), "utf8");

function envValue(name) {
  const line = envText
    .split(/\r?\n/)
    .find((candidate) => candidate.trimStart().startsWith(`${name}=`));
  if (!line) throw new Error(`${name} is missing from .env`);
  const value = line.slice(line.indexOf("=") + 1).trim();
  const unquoted = value.replace(/^(["'])(.*)\1$/, "$2");
  if (!unquoted) throw new Error(`${name} is empty in .env`);
  return unquoted;
}

async function check(label, url) {
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    await client.$queryRawUnsafe("SELECT 1");
    console.log(`${label}=OK`);
  } finally {
    await client.$disconnect();
  }
}

try {
  await check("TRANSACTION_POOLER", envValue("DATABASE_URL"));
  await check("SESSION_POOLER", envValue("DIRECT_URL"));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`DATABASE_CONNECTION_FAILED: ${message.replace(/postgresql:\/\/\S+/g, "[redacted-url]")}`);
  process.exitCode = 1;
}
