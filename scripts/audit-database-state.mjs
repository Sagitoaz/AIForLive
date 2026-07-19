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
  if (!line) return null;
  const value = line.slice(line.indexOf("=") + 1).trim();
  return value.replace(/^(["'])(.*)\1$/, "$2") || null;
}

const databaseUrl = envValue("DIRECT_URL") ?? envValue("DATABASE_URL");
if (!databaseUrl) throw new Error("DIRECT_URL or DATABASE_URL is missing from .env");

const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

try {
  const migrations = await client.$queryRawUnsafe(`
    SELECT migration_name,
           checksum,
           started_at,
           finished_at,
           rolled_back_at,
           applied_steps_count,
           logs
    FROM "_prisma_migrations"
    ORDER BY started_at
  `);
  const rowLevelSecurity = await client.$queryRawUnsafe(`
    SELECT c.relname AS table_name,
           c.relrowsecurity AS enabled,
           c.relforcerowsecurity AS forced
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
    ORDER BY c.relname
  `);
  const policies = await client.$queryRawUnsafe(`
    SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `);
  const seedKeyOwners = await client.$queryRawUnsafe(`
    SELECT 'organization' AS kind,
           "code" AS natural_key,
           COALESCE("metadataJson"->>'fixture', '') AS fixture
    FROM "Organization"
    WHERE "code" = 'STEAM-VIETNAM-DEMO'
    UNION ALL
    SELECT 'domain', "code", COALESCE("metadataJson"->>'fixture', '')
    FROM "LearningDomain"
    WHERE "code" = 'python-foundations'
    UNION ALL
    SELECT 'user', lower("email"), COALESCE("metadataJson"->>'fixture', '')
    FROM "User"
    WHERE lower("email") IN (
      'teacher@edurecall.local', 'thay.nam@edurecall.local', 'co.linh@edurecall.local',
      'minh@edurecall.local', 'lan@edurecall.local', 'an@edurecall.local',
      'binh@edurecall.local', 'chi@edurecall.local', 'dung@edurecall.local',
      'giang@edurecall.local', 'ha@edurecall.local', 'khanh@edurecall.local',
      'linh@edurecall.local', 'mai@edurecall.local', 'nam@edurecall.local',
      'oanh@edurecall.local', 'phuc@edurecall.local', 'quan@edurecall.local',
      'son@edurecall.local', 'trang@edurecall.local', 'uyen@edurecall.local',
      'viet@edurecall.local', 'yen@edurecall.local'
    )
    ORDER BY kind, natural_key
  `);
  const fixtureCounts = await client.$queryRawUnsafe(`
    SELECT
      (SELECT count(*)::int FROM "User" WHERE "metadataJson"->>'fixture' = 'pilot-v1') AS users,
      (SELECT count(*)::int FROM "Course" WHERE "metadataJson"->>'fixture' = 'pilot-v1') AS courses,
      (SELECT count(*)::int FROM "Class" WHERE "metadataJson"->>'fixture' = 'pilot-v1') AS classes,
      (SELECT count(*)::int FROM "Exercise" WHERE "metadataJson"->>'fixture' = 'pilot-v1') AS exercises,
      (SELECT count(*)::int FROM "LearningEvent" WHERE "metadataJson"->>'fixture' = 'pilot-v1') AS learning_events
  `);
  const legacyDemoDetails = await client.$queryRawUnsafe(`
    SELECT lower(u."email") AS email,
           u."role"::text AS role,
           u."status"::text AS status,
           u."deletedAt" IS NULL AS not_deleted,
           u."displayName" AS display_name,
           u."createdAt" AS created_at,
           EXISTS (SELECT 1 FROM "StudentProfile" s WHERE s."userId" = u."id") AS has_student_profile,
           EXISTS (SELECT 1 FROM "TeacherProfile" t WHERE t."userId" = u."id") AS has_teacher_profile
    FROM "User" AS u
    WHERE lower(u."email") IN (
      'teacher@edurecall.local', 'minh@edurecall.local', 'lan@edurecall.local'
    )
    ORDER BY email
  `);
  const legacyDomainDetails = await client.$queryRawUnsafe(`
    SELECT d."code",
           d."name",
           d."locale",
           d."status"::text AS status,
           d."deletedAt" IS NULL AS not_deleted,
           d."createdAt" AS created_at,
           (SELECT count(*)::int FROM "Course" c WHERE c."domainId" = d."id") AS course_count,
           (SELECT count(*)::int FROM "LearningConcept" c WHERE c."domainId" = d."id") AS concept_count
    FROM "LearningDomain" AS d
    WHERE d."code" = 'python-foundations'
  `);

  console.log(JSON.stringify({
    migrations,
    rowLevelSecurity,
    policies,
    seedKeyOwners,
    fixtureCounts,
    legacyDemoDetails,
    legacyDomainDetails
  }, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/postgresql:\/\/\S+/g, "[redacted-url]"));
  process.exitCode = 1;
} finally {
  await client.$disconnect();
}
