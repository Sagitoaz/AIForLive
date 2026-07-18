CREATE TYPE "LessonPhase" AS ENUM ('THEORY', 'PRACTICE', 'CHECKPOINT');
CREATE TYPE "ContentSourceStatus" AS ENUM ('PENDING_EXTRACTION', 'NEEDS_REVIEW', 'VERIFIED', 'REJECTED');

ALTER TABLE "LearningResource"
ADD COLUMN "phase" "LessonPhase" NOT NULL DEFAULT 'THEORY';

ALTER TABLE "Exercise"
ADD COLUMN "phase" "LessonPhase" NOT NULL DEFAULT 'PRACTICE';

ALTER TABLE "Recommendation"
ADD COLUMN "targetType" TEXT,
ADD COLUMN "targetId" TEXT,
ADD COLUMN "targetPhase" "LessonPhase",
ADD COLUMN "estimatedMinutes" INTEGER,
ADD COLUMN "candidateLogJson" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "ContentSource"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "ContentSource"
ALTER COLUMN "status" TYPE "ContentSourceStatus"
USING (CASE
  WHEN "status"::text = 'ACTIVE' THEN 'VERIFIED'::"ContentSourceStatus"
  ELSE 'PENDING_EXTRACTION'::"ContentSourceStatus"
END);

ALTER TABLE "ContentSource"
ALTER COLUMN "status" SET DEFAULT 'PENDING_EXTRACTION';

ALTER TABLE "ContentSource"
ADD COLUMN "verifiedAt" TIMESTAMP(3);

CREATE INDEX "LearningResource_lessonId_phase_status_idx"
ON "LearningResource"("lessonId", "phase", "status");

CREATE INDEX "Exercise_lessonId_phase_status_idx"
ON "Exercise"("lessonId", "phase", "status");

DROP INDEX IF EXISTS "LearningResource_lessonId_status_idx";
