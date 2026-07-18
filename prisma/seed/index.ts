import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import concepts from "../../domains/python-foundations/concepts.json";
import misconceptions from "../../domains/python-foundations/misconceptions.json";
import prerequisites from "../../domains/python-foundations/prerequisites.json";

const prisma = new PrismaClient();

const studentNames = [
  "Minh", "Lan", "An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khánh", "Linh",
  "Mai", "Nam", "Oanh", "Phúc", "Quân", "Sơn", "Trang", "Uyên", "Việt", "Yến"
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash("Demo@123", 10);
  const organization = await prisma.organization.upsert({
    where: { code: "EDURECALL-PILOT" },
    update: {},
    create: { code: "EDURECALL-PILOT", name: "EduRecall Pilot School" }
  });
  const teacherUser = await prisma.user.upsert({
    where: { email: "teacher@edurecall.local" },
    update: { passwordHash },
    create: {
      email: "teacher@edurecall.local",
      passwordHash,
      role: UserRole.TEACHER,
      displayName: "Cô Mai",
      nickname: "Cô Mai",
      avatarKey: "avatar-01"
    }
  });
  const teacher = await prisma.teacherProfile.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: { userId: teacherUser.id, specialization: "Tin học giáo dục" }
  });
  const domain = await prisma.learningDomain.upsert({
    where: { code: "python-foundations" },
    update: {},
    create: {
      code: "python-foundations",
      name: "Python Foundations",
      version: "1.0.0",
      definitionJson: { package: "domains/python-foundations" }
    }
  });
  const course = await prisma.course.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "PYTHON-PILOT" } },
    update: {},
    create: {
      organizationId: organization.id,
      domainId: domain.id,
      code: "PYTHON-PILOT",
      title: "Python cơ bản cho học sinh",
      description: "Học Python qua nhiệm vụ, trò chơi và ôn tập cá nhân hóa.",
      coverAssetKey: "course-cover-01",
      estimatedHours: 12
    }
  });
  const learningClass = await prisma.learningClass.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "PY-01" } },
    update: {},
    create: {
      organizationId: organization.id,
      teacherId: teacher.id,
      code: "PY-01",
      name: "Python Explorers — Lớp thử nghiệm"
    }
  });
  const conceptIds = new Map<string, string>();
  for (const concept of concepts) {
    const record = await prisma.learningConcept.upsert({
      where: { domainId_code: { domainId: domain.id, code: concept.code } },
      update: {},
      create: {
        domainId: domain.id,
        code: concept.code,
        title: concept.title,
        description: concept.description,
        iconAssetKey: concept.icon,
        order: concept.order
      }
    });
    conceptIds.set(concept.code, record.id);
  }
  for (const edge of prerequisites) {
    const prerequisiteId = conceptIds.get(edge.from);
    const targetId = conceptIds.get(edge.to);
    if (prerequisiteId && targetId) {
      await prisma.conceptPrerequisite.upsert({
        where: {
          prerequisiteConceptId_targetConceptId: {
            prerequisiteConceptId: prerequisiteId,
            targetConceptId: targetId
          }
        },
        update: { weight: edge.weight },
        create: { prerequisiteConceptId: prerequisiteId, targetConceptId: targetId, weight: edge.weight }
      });
    }
  }
  for (const misconception of misconceptions) {
    const conceptId = conceptIds.get(misconception.conceptCode);
    if (!conceptId) continue;
    await prisma.misconception.upsert({
      where: { domainId_code: { domainId: domain.id, code: misconception.code } },
      update: {},
      create: {
        domainId: domain.id,
        conceptId,
        code: misconception.code,
        title: misconception.title,
        description: misconception.description,
        severity: misconception.severity
      }
    });
  }
  const modules = [];
  for (let moduleIndex = 0; moduleIndex < 4; moduleIndex += 1) {
    modules.push(await prisma.courseModule.upsert({
      where: { courseId_code: { courseId: course.id, code: `MODULE-${moduleIndex + 1}` } },
      update: {},
      create: {
        courseId: course.id,
        code: `MODULE-${moduleIndex + 1}`,
        title: ["Khởi động", "Ra quyết định", "Lặp thông minh", "Dữ liệu & hàm"][moduleIndex] ?? "Module",
        order: moduleIndex + 1
      }
    }));
  }
  for (let index = 0; index < 10; index += 1) {
    const concept = concepts[index % concepts.length];
    const conceptId = conceptIds.get(concept.code);
    if (!conceptId) continue;
    const module = modules[Math.min(3, Math.floor(index / 3))];
    if (!module) continue;
    const lesson = await prisma.lesson.upsert({
      where: { moduleId_code: { moduleId: module.id, code: `LESSON-${index + 1}` } },
      update: {},
      create: {
        moduleId: module.id,
        conceptId,
        code: `LESSON-${index + 1}`,
        title: index < 8 ? concept.title : `${concept.title} — thử thách`,
        summary: concept.description,
        order: (index % 3) + 1,
        durationMinutes: 10 + (index % 3) * 3
      }
    });
    for (let exerciseIndex = 0; exerciseIndex < 5; exerciseIndex += 1) {
      const exercise = await prisma.exercise.upsert({
        where: { lessonId_code: { lessonId: lesson.id, code: `EX-${index + 1}-${exerciseIndex + 1}` } },
        update: {},
        create: {
          lessonId: lesson.id,
          code: `EX-${index + 1}-${exerciseIndex + 1}`,
          type: ["MULTIPLE_CHOICE", "CODE_ORDER", "PREDICT_OUTPUT", "BUG_HUNTER", "GAME"][exerciseIndex] ?? "MULTIPLE_CHOICE",
          prompt: `Nhiệm vụ ${exerciseIndex + 1}: ${concept.title}`,
          difficulty: 0.25 + exerciseIndex * 0.12,
          contentJson: { conceptCode: concept.code },
          answerJson: { demo: true }
        }
      });
      await prisma.exerciseConcept.upsert({
        where: { exerciseId_conceptId: { exerciseId: exercise.id, conceptId } },
        update: {},
        create: { exerciseId: exercise.id, conceptId, isPrimary: true }
      });
    }
  }
  for (let index = 0; index < studentNames.length; index += 1) {
    const name = studentNames[index] ?? `Student ${index + 1}`;
    const email = index === 0 ? "minh@edurecall.local" : index === 1 ? "lan@edurecall.local" : `student${index + 1}@edurecall.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: {
        email,
        passwordHash,
        role: UserRole.STUDENT,
        displayName: name,
        nickname: `${name} ${["🌱", "🚀", "✨", "🧩"][index % 4]}`,
        avatarKey: `avatar-${String(index + 1).padStart(2, "0")}`
      }
    });
    const student = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        gradeLevel: "THCS",
        learningGoal: "Tự viết một mini game Python sau 4 tuần",
        weeklyAvailabilityMinutes: [90, 120, 150][index % 3] ?? 120,
        xp: 240 + index * 37,
        level: 2 + (index % 5),
        streakDays: 1 + (index % 9)
      }
    });
    await prisma.enrollment.upsert({
      where: { studentProfileId_classId_courseId: { studentProfileId: student.id, classId: learningClass.id, courseId: course.id } },
      update: {},
      create: { studentProfileId: student.id, classId: learningClass.id, courseId: course.id, progress: 0.18 + (index % 8) * 0.08 }
    });
    for (const [conceptIndex, concept] of concepts.entries()) {
      const conceptId = conceptIds.get(concept.code);
      if (!conceptId) continue;
      const mastery = Math.max(0.18, Math.min(0.94, 0.38 + ((index * 7 + conceptIndex * 11) % 50) / 100));
      await prisma.studentConceptState.upsert({
        where: { studentProfileId_conceptId: { studentProfileId: student.id, conceptId } },
        update: {},
        create: {
          studentProfileId: student.id,
          conceptId,
          mastery,
          stability: 1.5 + mastery * 5,
          retrievability: Math.max(0.2, mastery - 0.08),
          forgettingRisk: Math.min(0.8, 1 - mastery + 0.08),
          nextAttemptProbability: mastery * 0.82,
          modelVersion: "bkt-v1"
        }
      });
    }
  }
  console.log("Seeded 1 domain, 1 course, 1 class, 20 students, 8 concepts, 10 lessons and 50 exercises.");
}

async function run(): Promise<void> {
  try {
    await main();
  } finally {
    await prisma.$disconnect();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
