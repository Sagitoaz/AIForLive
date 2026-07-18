-- Additive course-planning workflow. This migration intentionally does not
-- modify existing lesson or generated-content records.
CREATE TABLE "CoursePlanDraft" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "classId" TEXT,
    "requestedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "gradeBand" TEXT NOT NULL,
    "goalsJson" JSONB NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "provider" TEXT NOT NULL DEFAULT 'LOCAL_CATALOG_PLANNER',
    "modelVersion" TEXT NOT NULL DEFAULT 'course-plan-v1',
    "inputJson" JSONB NOT NULL,
    "catalogSnapshotJson" JSONB NOT NULL,
    "aiDraftJson" JSONB NOT NULL,
    "planJson" JSONB NOT NULL,
    "reviewHistoryJson" JSONB NOT NULL DEFAULT '[]',
    "teacherEditingSeconds" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoursePlanDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoursePlanDraft_requestedById_status_updatedAt_idx"
ON "CoursePlanDraft"("requestedById", "status", "updatedAt");

CREATE INDEX "CoursePlanDraft_courseId_status_idx"
ON "CoursePlanDraft"("courseId", "status");

CREATE INDEX "CoursePlanDraft_classId_status_idx"
ON "CoursePlanDraft"("classId", "status");

ALTER TABLE "CoursePlanDraft"
ADD CONSTRAINT "CoursePlanDraft_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoursePlanDraft"
ADD CONSTRAINT "CoursePlanDraft_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoursePlanDraft"
ADD CONSTRAINT "CoursePlanDraft_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
