-- Add explicit co-teacher membership without removing the existing primary
-- owner relation on Class.teacherId. Existing class owners are backfilled as
-- OWNER members so authorization can migrate to the join without downtime.

CREATE TYPE "ClassTeacherRole" AS ENUM ('OWNER', 'INSTRUCTOR', 'REVIEWER');

CREATE TABLE "ClassTeacherMembership" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "role" "ClassTeacherRole" NOT NULL DEFAULT 'INSTRUCTOR',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClassTeacherMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassTeacherMembership_classId_teacherProfileId_key"
    ON "ClassTeacherMembership"("classId", "teacherProfileId");

CREATE INDEX "ClassTeacherMembership_teacherProfileId_status_idx"
    ON "ClassTeacherMembership"("teacherProfileId", "status");

CREATE INDEX "ClassTeacherMembership_classId_status_idx"
    ON "ClassTeacherMembership"("classId", "status");

ALTER TABLE "ClassTeacherMembership"
    ADD CONSTRAINT "ClassTeacherMembership_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "Class"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassTeacherMembership"
    ADD CONSTRAINT "ClassTeacherMembership_teacherProfileId_fkey"
    FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ClassTeacherMembership" (
    "id",
    "classId",
    "teacherProfileId",
    "role",
    "status",
    "metadataJson",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT
    substring(md5('edurecall-class-owner:' || class_row."id" || ':' || class_row."teacherId"), 1, 8)
        || '-' || substring(md5('edurecall-class-owner:' || class_row."id" || ':' || class_row."teacherId"), 9, 4)
        || '-5' || substring(md5('edurecall-class-owner:' || class_row."id" || ':' || class_row."teacherId"), 14, 3)
        || '-a' || substring(md5('edurecall-class-owner:' || class_row."id" || ':' || class_row."teacherId"), 18, 3)
        || '-' || substring(md5('edurecall-class-owner:' || class_row."id" || ':' || class_row."teacherId"), 21, 12),
    class_row."id",
    class_row."teacherId",
    'OWNER'::"ClassTeacherRole",
    class_row."status",
    jsonb_build_object(
        'backfilledFromPrimaryTeacher', true,
        'migration', '202607190001_class_teacher_memberships'
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    class_row."deletedAt"
FROM "Class" AS class_row
ON CONFLICT ("classId", "teacherProfileId") DO NOTHING;

-- Match the API-only database boundary used by the existing public tables.
ALTER TABLE "ClassTeacherMembership" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL PRIVILEGES ON TABLE "ClassTeacherMembership" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL PRIVILEGES ON TABLE "ClassTeacherMembership" FROM authenticated;
    END IF;
END
$$;
