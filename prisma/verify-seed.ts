import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FIXTURE = "pilot-v1";

type CountCheck = { label: string; expected: number; actual: number };

function objectJson(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function stringArray(value: Prisma.JsonValue | undefined): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? (value as string[])
    : [];
}

async function verify(): Promise<void> {
  const [
    users,
    teacherProfiles,
    studentProfiles,
    organizations,
    domains,
    concepts,
    prerequisites,
    misconceptions,
    diagnosisRules,
    courses,
    classes,
    memberships,
    enrollments,
    modules,
    lessons,
    resources,
    exercises,
    sources,
    chunks,
    conceptStates,
    histories,
    learningEvents,
    attempts,
    recommendations,
    recommendationEvidence,
    reviewSchedules
  ] = await prisma.$transaction([
    prisma.user.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.teacherProfile.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.studentProfile.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.organization.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.learningDomain.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.learningConcept.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.conceptPrerequisite.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.misconception.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.domainDiagnosisRule.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.course.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.learningClass.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.classTeacherMembership.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.enrollment.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.courseModule.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.lesson.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.learningResource.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.exercise.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.contentSource.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.sourceChunk.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.studentConceptState.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.conceptStateHistory.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.learningEvent.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.attempt.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.recommendation.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } }),
    prisma.recommendationEvidence.count({ where: { recommendation: { metadataJson: { path: ["fixture"], equals: FIXTURE } } } }),
    prisma.reviewSchedule.count({ where: { metadataJson: { path: ["fixture"], equals: FIXTURE } } })
  ]);

  const checks: CountCheck[] = [
    { label: "demo users", expected: 23, actual: users },
    { label: "teacher profiles", expected: 3, actual: teacherProfiles },
    { label: "student profiles", expected: 20, actual: studentProfiles },
    { label: "organizations", expected: 1, actual: organizations },
    { label: "domains", expected: 1, actual: domains },
    { label: "concepts", expected: 8, actual: concepts },
    { label: "prerequisites", expected: 10, actual: prerequisites },
    { label: "misconceptions", expected: 10, actual: misconceptions },
    { label: "diagnosis rules", expected: 3, actual: diagnosisRules },
    { label: "courses", expected: 1, actual: courses },
    { label: "classes", expected: 1, actual: classes },
    { label: "teacher memberships", expected: 3, actual: memberships },
    { label: "enrollments", expected: 20, actual: enrollments },
    { label: "modules", expected: 4, actual: modules },
    { label: "lessons", expected: 12, actual: lessons },
    { label: "resources", expected: 36, actual: resources },
    { label: "teacher-reviewed exercises", expected: 60, actual: exercises },
    { label: "verified content sources", expected: 1, actual: sources },
    { label: "source chunks", expected: 3, actual: chunks },
    { label: "concept states", expected: 160, actual: conceptStates },
    { label: "synthetic history rows", expected: 400, actual: histories },
    { label: "linked learning events", expected: 20, actual: learningEvents },
    { label: "linked attempts", expected: 20, actual: attempts },
    { label: "traceable recommendations", expected: 20, actual: recommendations },
    { label: "recommendation evidence rows", expected: 20, actual: recommendationEvidence },
    { label: "review schedules", expected: 20, actual: reviewSchedules }
  ];

  const mismatches = checks.filter((check) => check.actual !== check.expected);
  if (mismatches.length > 0) {
    throw new Error(
      `Seed count mismatch: ${mismatches.map((check) => `${check.label}=${check.actual}, expected=${check.expected}`).join("; ")}`
    );
  }

  const [accounts, membershipsByRole, sourceRows, exerciseRows, demoClass, fixtureCourse, stateRows, historyRows, recommendationRows] = await Promise.all([
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        AND: [
          { metadataJson: { path: ["fixture"], equals: FIXTURE } },
          { metadataJson: { path: ["synthetic"], equals: true } },
          { metadataJson: { path: ["demoAccount"], equals: true } }
        ]
      },
      select: { id: true, email: true, displayName: true, role: true, avatarKey: true }
    }),
    prisma.classTeacherMembership.groupBy({
      by: ["role"],
      where: { status: "ACTIVE", deletedAt: null, metadataJson: { path: ["fixture"], equals: FIXTURE } },
      _count: { _all: true }
    }),
    prisma.contentSource.findMany({
      where: { metadataJson: { path: ["fixture"], equals: FIXTURE } },
      select: { status: true, verifiedAt: true, extractedText: true }
    }),
    prisma.exercise.findMany({
      where: { metadataJson: { path: ["fixture"], equals: FIXTURE } },
      select: { id: true, code: true, type: true, phase: true, status: true, deletedAt: true, contentJson: true, answerJson: true, concepts: { select: { conceptId: true, isPrimary: true } } }
    }),
    prisma.learningClass.findFirst({
      where: { metadataJson: { path: ["fixture"], equals: FIXTURE } },
      include: {
        teacherMemberships: true,
        enrollments: { include: { student: true, course: true } }
      }
    }),
    prisma.course.findFirst({
      where: { metadataJson: { path: ["fixture"], equals: FIXTURE } },
      include: {
        modules: {
          include: {
            lessons: { include: { resources: true, exercises: true } }
          }
        }
      }
    }),
    prisma.studentConceptState.findMany({
      where: { metadataJson: { path: ["fixture"], equals: FIXTURE } },
      select: { studentProfileId: true, conceptId: true, lastPracticedAt: true, metadataJson: true }
    }),
    prisma.conceptStateHistory.findMany({
      where: { metadataJson: { path: ["fixture"], equals: FIXTURE } },
      select: { id: true, studentProfileId: true, conceptId: true, recordedAt: true, metadataJson: true }
    }),
    prisma.recommendation.findMany({
      where: { metadataJson: { path: ["fixture"], equals: FIXTURE } },
      include: {
        evidence: { include: { attempt: { include: { event: true } } } }
      }
    })
  ]);

  if (accounts.length !== 23 || accounts.some((account) => !account.id || !account.email || !account.displayName)) {
    throw new Error("Demo account identity check failed");
  }
  if (accounts.some((account) => !account.avatarKey || !/^avatar-\d{2}$/.test(account.avatarKey))) {
    throw new Error("Demo accounts must reference an existing avatar key shape");
  }
  const roleCounts = new Map(membershipsByRole.map((row) => [row.role, row._count._all] as const));
  if (roleCounts.get("OWNER") !== 1 || roleCounts.get("INSTRUCTOR") !== 1 || roleCounts.get("REVIEWER") !== 1) {
    throw new Error("Teacher membership roles must contain exactly one OWNER, INSTRUCTOR and REVIEWER");
  }
  const sourceRow = sourceRows[0];
  if (!sourceRow || sourceRows.length !== 1 || sourceRow.status !== "VERIFIED" || !sourceRow.verifiedAt || !sourceRow.extractedText) {
    throw new Error("Grounding source must be VERIFIED and contain extracted text");
  }
  if (!demoClass || demoClass.status !== "ACTIVE" || demoClass.deletedAt || demoClass.enrollments.length !== 20) {
    throw new Error("Fixture class must be active and contain exactly 20 enrollments");
  }
  if (objectJson(demoClass.metadataJson).primaryDemoClass !== true) {
    throw new Error("Fixture class must be the explicit primary demo context");
  }
  if (demoClass.enrollments.some((row) => row.status !== "ACTIVE" || row.deletedAt || row.course.status !== "ACTIVE" || row.course.deletedAt || row.student.status !== "ACTIVE" || row.student.deletedAt)) {
    throw new Error("Every fixture enrollment, student profile and course must be active and non-deleted");
  }
  if (demoClass.teacherMemberships.some((row) => row.status !== "ACTIVE" || row.deletedAt)) {
    throw new Error("Every fixture teacher membership must be active and non-deleted");
  }
  if (!fixtureCourse || fixtureCourse.status !== "ACTIVE" || fixtureCourse.deletedAt || fixtureCourse.modules.length !== 4) {
    throw new Error("Fixture course topology is invalid");
  }
  const topologyLessons = fixtureCourse.modules.flatMap((module) => module.lessons);
  if (topologyLessons.length !== 12 || topologyLessons.some((lesson) => lesson.status !== "ACTIVE" || lesson.deletedAt || lesson.resources.length !== 3 || lesson.exercises.length !== 5)) {
    throw new Error("Fixture course must contain 12 active lessons with 3 resources and 5 exercises each");
  }
  const registeredAnimationTemplates = new Set([
    "NUMBER_SEQUENCE",
    "VARIABLE_CHANGE",
    "CODE_HIGHLIGHT",
    "FLOW_BRANCH",
    "LOOP_TIMELINE",
    "LIST_INDEX",
    "FUNCTION_FLOW",
    "BUG_REVEAL"
  ]);
  for (const lesson of topologyLessons) {
    const theoryAnimations = lesson.resources.filter((resource) => resource.phase === "THEORY" && resource.type === "ANIMATION");
    const content = theoryAnimations[0] ? objectJson(theoryAnimations[0].contentJson) : {};
    const animationData = objectJson(content.animationData);
    if (
      theoryAnimations.length !== 1
      || typeof content.animationTemplate !== "string"
      || !registeredAnimationTemplates.has(content.animationTemplate)
      || Object.keys(animationData).length === 0
      || typeof content.narration !== "string"
      || !content.narration.trim()
    ) {
      throw new Error(`${lesson.code} must expose one registered theory animation with non-empty narration`);
    }
  }
  const rangeConceptId = exerciseRows.find((exercise) => exercise.code === "EX-08-1")?.concepts[0]?.conceptId;
  const rangeLesson = topologyLessons.find((lesson) => lesson.conceptId === rangeConceptId);
  const rangeAnimations = rangeLesson?.resources.filter((resource) => {
    const content = objectJson(resource.contentJson);
    const data = objectJson(content.animationData);
    return resource.type === "ANIMATION"
      && content.animationTemplate === "NUMBER_SEQUENCE"
      && data.start === 2
      && data.stop === 5
      && Array.isArray(data.values)
      && data.values.join(",") === "2,3,4";
  }) ?? [];
  if (rangeAnimations.length !== 1) {
    throw new Error("PYTHON_RANGE fixture must expose one registered NUMBER_SEQUENCE animation that excludes stop");
  }
  const statePairs = new Set(stateRows.map((row) => `${row.studentProfileId}:${row.conceptId}`));
  if (stateRows.length !== 160 || statePairs.size !== 160 || stateRows.some((row) => objectJson(row.metadataJson).modelSnapshotOnly !== true)) {
    throw new Error("Concept-state snapshot must contain 160 unique, explicitly labelled model-only pairs");
  }
  const now = Date.now();
  if (stateRows.some((row) => row.lastPracticedAt && row.lastPracticedAt.getTime() > now)) {
    throw new Error("Concept state contains future learner evidence");
  }
  if (historyRows.length !== 400 || new Set(historyRows.map((row) => row.id)).size !== 400 || historyRows.some((row) => row.recordedAt.getTime() > now)) {
    throw new Error("Synthetic history must contain 400 unique rows with no future timestamps");
  }
  if (historyRows.some((row) => objectJson(row.metadataJson).modelSnapshotOnly !== true || objectJson(row.metadataJson).linkedLearningEvent !== false)) {
    throw new Error("Synthetic histories must disclose that they are model snapshots, not linked learning events");
  }
  const exercisesById = new Map(exerciseRows.map((exercise) => [exercise.id, exercise] as const));
  if (recommendationRows.length !== 20 || recommendationRows.some((row) => {
    const metadata = objectJson(row.metadataJson);
    const selectedCode = objectJson(row.candidateLogJson).selectedExerciseCode;
    const target = typeof row.targetId === "string" ? exercisesById.get(row.targetId) : undefined;
    return row.status !== "ACTIVE"
      || row.targetType !== "EXERCISE"
      || !target
      || target.status !== "ACTIVE"
      || target.deletedAt !== null
      || typeof selectedCode !== "string"
      || target.code !== selectedCode
      || metadata.educationalImpactEvidence !== false
      || row.evidence.length !== 1
      || !row.evidence[0]?.attempt
      || row.evidence[0].attempt.event.courseId !== fixtureCourse.id;
  })) {
    throw new Error("Each fixture recommendation must resolve to a reviewed exercise and one same-course linked attempt");
  }

  let ideaRubrics = 0;
  let codeOrders = 0;
  for (const exercise of exerciseRows) {
    const content = objectJson(exercise.contentJson);
    const answer = objectJson(exercise.answerJson);
    if (answer.teacherReviewed !== true) throw new Error(`${exercise.code} is not teacher reviewed`);
    if (exercise.status !== "ACTIVE" || exercise.deletedAt || exercise.concepts.length !== 1 || exercise.concepts[0]?.isPrimary !== true) {
      throw new Error(`${exercise.code} must be active, non-deleted and linked to one primary concept`);
    }
    if (answer.strategy === "IDEA_RUBRIC") {
      ideaRubrics += 1;
      if (content.syntaxPolicy !== "IGNORE" || content.responseMode !== "PSEUDOCODE") {
        throw new Error(`${exercise.code} does not use syntax-independent pseudocode`);
      }
      if (exercise.phase !== "PRACTICE") throw new Error(`${exercise.code} uses advisory AI grading outside PRACTICE`);
    }
    if (answer.strategy === "CODE_ORDER") {
      codeOrders += 1;
      const blocks = Array.isArray(content.blocks) ? content.blocks : [];
      const publicIds = blocks.flatMap((block) => {
        const object = objectJson(block);
        return typeof object.id === "string" ? [object.id] : [];
      });
      const acceptedOrders = Array.isArray(answer.acceptedBlockOrders) ? answer.acceptedBlockOrders : [];
      if (
        publicIds.length === 0 ||
        new Set(publicIds).size !== publicIds.length ||
        acceptedOrders.length === 0 ||
        acceptedOrders.some((order) => {
          const accepted = stringArray(order);
          return (
            accepted.length !== publicIds.length ||
            new Set(accepted).size !== accepted.length ||
            accepted.some((id) => !publicIds.includes(id)) ||
            publicIds.some((id) => !accepted.includes(id))
          );
        })
      ) {
        throw new Error(`${exercise.code} has an invalid code-order contract`);
      }
      if ("acceptedBlockOrders" in content) throw new Error(`${exercise.code} leaks its accepted order to the client`);
    }
  }
  if (ideaRubrics !== 12 || codeOrders !== 24) {
    throw new Error(`Exercise contract mismatch: IDEA_RUBRIC=${ideaRubrics}, CODE_ORDER=${codeOrders}`);
  }

  for (const check of checks) console.log(`${check.label}: ${check.actual}/${check.expected}`);
  console.log(`Seed ${FIXTURE} passed synthetic labels, active topology, grading-contract and no-future-evidence checks.`);
}

verify()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message.replace(/postgresql:\/\/\S+/g, "[redacted-url]"));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
