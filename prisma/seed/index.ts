import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import concepts from "../../domains/python-foundations/concepts.json";
import misconceptions from "../../domains/python-foundations/misconceptions.json";
import prerequisites from "../../domains/python-foundations/prerequisites.json";

const prisma = new PrismaClient();

const studentNames = [
  "Minh", "Lan", "An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khánh", "Linh",
  "Mai", "Nam", "Oanh", "Phúc", "Quân", "Sơn", "Trang", "Uyên", "Việt", "Yến"
];

const moduleBlueprints = [
  ["MODULE-1", "Khởi động cùng Python", "Môi trường, biến, dữ liệu đầu vào và phép tính."],
  ["MODULE-2", "Chương trình biết lựa chọn", "Biểu thức đúng/sai và nhánh xử lý rõ ràng."],
  ["MODULE-3", "Lặp có kiểm soát", "for, range, while và cách tránh vòng lặp vô hạn."],
  ["MODULE-4", "Dữ liệu, hàm và dự án", "List, hàm và trò chơi hỏi–đáp cuối khóa."]
] as const;

const lessonBlueprints = [
  ["LESSON-01", "Ra lệnh cho máy tính", "PYTHON_VARIABLES", 45, "Dùng print() và đọc lỗi cú pháp cơ bản."],
  ["LESSON-02", "Biến và kiểu dữ liệu", "PYTHON_VARIABLES", 55, "Giải thích biến, chuỗi, số nguyên và số thực."],
  ["LESSON-03", "Nhập liệu và phép tính", "PYTHON_OPERATORS", 60, "Nhận input, chuyển kiểu và tính một biểu thức."],
  ["LESSON-04", "So sánh và giá trị đúng/sai", "PYTHON_OPERATORS", 55, "Tạo biểu thức Boolean bằng toán tử so sánh."],
  ["LESSON-05", "Rẽ nhánh với if / elif / else", "PYTHON_IF_ELSE", 70, "Thiết kế nhánh không chồng chéo và đúng thứ tự."],
  ["LESSON-06", "Checkpoint: Trợ lý kế hoạch học", "PYTHON_IF_ELSE", 60, "Kết hợp input, phép tính và điều kiện trong sản phẩm nhỏ."],
  ["LESSON-07", "Vòng lặp for", "PYTHON_FOR", 55, "Mô tả từng lượt lặp và biến điều khiển."],
  ["LESSON-08", "Khám phá range()", "PYTHON_RANGE", 65, "Đọc đúng start, stop, step và tránh lỗi lệch một đơn vị."],
  ["LESSON-09", "while và điều kiện dừng", "PYTHON_WHILE", 70, "Dùng while khi chưa biết trước số lượt lặp."],
  ["LESSON-10", "List và vị trí phần tử", "PYTHON_LISTS", 65, "Tạo list, truy cập index và duyệt phần tử."],
  ["LESSON-11", "Hàm, tham số và return", "PYTHON_FUNCTIONS", 75, "Tách chương trình thành hàm nhỏ có đầu vào và đầu ra."],
  ["LESSON-12", "Dự án: Trò chơi hỏi–đáp", "PYTHON_FUNCTIONS", 120, "Ghép list, hàm, điều kiện và vòng lặp thành sản phẩm cuối khóa."]
] as const;

const studentGoals = ["Tạo trò chơi hỏi–đáp", "Củng cố tư duy logic", "Chuẩn bị CLB Tin học", "Học theo tốc độ riêng"] as const;
const devices = ["Máy tính cá nhân", "Máy tính bảng", "Điện thoại dùng chung", "Máy tính ở thư viện"] as const;

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
    update: {
      title: "Python căn bản: Từ câu lệnh đầu tiên đến trò chơi tương tác",
      description: "Khóa học 6 tuần cho học sinh lớp 6–9; 12 bài có lý thuyết, thực hành và kiểm tra cuối bài.",
      estimatedHours: 16
    },
    create: {
      organizationId: organization.id,
      domainId: domain.id,
      code: "PYTHON-PILOT",
      title: "Python căn bản: Từ câu lệnh đầu tiên đến trò chơi tương tác",
      description: "Khóa học 6 tuần cho học sinh lớp 6–9; 12 bài có lý thuyết, thực hành và kiểm tra cuối bài.",
      coverAssetKey: "course-cover-01",
      estimatedHours: 16
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
  const handbookText = "range(start, stop, step) lấy start, dừng trước stop. Ví dụ list(range(1, 5)) là [1, 2, 3, 4].";
  const handbookChecksum = createHash("sha256").update(handbookText).digest("hex");
  await prisma.contentSource.upsert({
    where: { courseId_checksum: { courseId: course.id, checksum: handbookChecksum } },
    update: { extractedText: handbookText, status: "VERIFIED", verifiedAt: new Date(), metadataJson: { verifiedBy: teacherUser.id, sourceVersion: "1.3" } },
    create: {
      id: "source-python-handbook-01",
      courseId: course.id,
      uploadedById: teacherUser.id,
      name: "Python handbook nội bộ · bản 1.3.txt",
      type: "DATABASE",
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength(handbookText),
      checksum: handbookChecksum,
      extractedText: handbookText,
      status: "VERIFIED",
      verifiedAt: new Date(),
      metadataJson: { verifiedBy: teacherUser.id, sourceVersion: "1.3" }
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
  for (let moduleIndex = 0; moduleIndex < moduleBlueprints.length; moduleIndex += 1) {
    const blueprint = moduleBlueprints[moduleIndex];
    if (!blueprint) continue;
    modules.push(await prisma.courseModule.upsert({
      where: { courseId_code: { courseId: course.id, code: blueprint[0] } },
      update: { title: blueprint[1], description: blueprint[2], order: moduleIndex + 1 },
      create: {
        courseId: course.id,
        code: blueprint[0],
        title: blueprint[1],
        description: blueprint[2],
        order: moduleIndex + 1
      }
    }));
  }
  for (let index = 0; index < lessonBlueprints.length; index += 1) {
    const blueprint = lessonBlueprints[index];
    if (!blueprint) continue;
    const [lessonCode, title, conceptCode, durationMinutes, summary] = blueprint;
    const conceptId = conceptIds.get(conceptCode);
    if (!conceptId) continue;
    const module = modules[Math.min(3, Math.floor(index / 3))];
    if (!module) continue;
    const lesson = await prisma.lesson.upsert({
      where: { moduleId_code: { moduleId: module.id, code: lessonCode } },
      update: { title, summary, order: (index % 3) + 1, durationMinutes },
      create: {
        moduleId: module.id,
        conceptId,
        code: lessonCode,
        title,
        summary,
        order: (index % 3) + 1,
        durationMinutes,
        metadataJson: { gradeBand: "Lớp 6–9", structureVersion: "three-phase-v1" }
      }
    });
    const resources = [
      ["THEORY", "LECTURE", `Bài giảng: ${title}`, Math.round(durationMinutes * 0.22)],
      ["THEORY", "ANIMATION", `AI animation: ${title}`, Math.max(5, Math.round(durationMinutes * 0.1))],
      ["THEORY", "DOCUMENT", `Phiếu ghi nhớ: ${title}`, Math.max(4, Math.round(durationMinutes * 0.06))]
    ] as const;
    for (const [phase, type, resourceTitle, minutes] of resources) {
      await prisma.learningResource.upsert({
        where: { id: `resource-${lessonCode.toLowerCase()}-${type.toLowerCase()}` },
        update: { phase, type, title: resourceTitle, contentJson: { estimatedMinutes: minutes, locale: "vi-VN", sourceId: "source-python-handbook-01" } },
        create: { id: `resource-${lessonCode.toLowerCase()}-${type.toLowerCase()}`, lessonId: lesson.id, phase, type, title: resourceTitle, contentJson: { estimatedMinutes: minutes, locale: "vi-VN", sourceId: "source-python-handbook-01" } }
      });
    }
    for (let exerciseIndex = 0; exerciseIndex < 7; exerciseIndex += 1) {
      const isCheckpoint = exerciseIndex >= 4;
      const exerciseNumber = exerciseIndex + 1;
      const exerciseType = isCheckpoint ? (["MULTIPLE_CHOICE", "CODE", "EXPLAIN_CODE"][exerciseIndex - 4] ?? "MULTIPLE_CHOICE") : (["PREDICT_OUTPUT", "CODE_ORDER", "CODE", "DEBUG"] as const)[exerciseIndex] ?? "CODE";
      const exerciseCode = `EX-${String(index + 1).padStart(2, "0")}-${exerciseNumber}`;
      const exercise = await prisma.exercise.upsert({
        where: { lessonId_code: { lessonId: lesson.id, code: exerciseCode } },
        update: { phase: isCheckpoint ? "CHECKPOINT" : "PRACTICE", type: exerciseType, prompt: `${isCheckpoint ? "Kiểm tra chuyển giao" : "Thực hành"} ${exerciseNumber}: ${summary}`, difficulty: Number((0.28 + exerciseIndex * 0.09 + (index % 3) * 0.025).toFixed(2)) },
        create: {
          lessonId: lesson.id,
          code: exerciseCode,
          phase: isCheckpoint ? "CHECKPOINT" : "PRACTICE",
          type: exerciseType,
          prompt: `${isCheckpoint ? "Kiểm tra chuyển giao" : "Thực hành"} ${exerciseNumber}: ${summary}`,
          difficulty: Number((0.28 + exerciseIndex * 0.09 + (index % 3) * 0.025).toFixed(2)),
          contentJson: { conceptCode, locale: "vi-VN", estimatedSeconds: 90 + exerciseIndex * 35, requiresExplanation: exerciseType === "EXPLAIN_CODE", testCaseCount: exerciseType === "CODE" ? 4 : 0 },
          answerJson: { evaluationMode: exerciseType === "CODE" ? "TEST_CASES" : "STRUCTURED", teacherReviewed: true },
          metadataJson: { datasetVersion: "pilot-realistic-v2", source: "teacher-authored-seed" }
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
      update: {
        gradeLevel: `Lớp ${6 + (index % 4)}`,
        learningGoal: studentGoals[index % studentGoals.length],
        weeklyAvailabilityMinutes: [90, 120, 150, 75, 180][index % 5] ?? 120,
        responseSpeed: Number((0.72 + (index % 7) * 0.09).toFixed(2)),
        hintUsageRate: Number((0.08 + (index % 6) * 0.07).toFixed(2)),
        forgettingRate: Number((0.09 + (index % 5) * 0.035).toFixed(3)),
        consistencyScore: Number((0.48 + (index % 8) * 0.06).toFixed(2)),
        engagementLevel: Number((0.5 + ((index * 3) % 8) * 0.055).toFixed(2)),
        metadataJson: { device: devices[index % devices.length], connectivity: index % 7 === 0 ? "UNSTABLE" : index % 5 === 0 ? "OCCASIONAL_OFFLINE" : "STABLE", sharedDevice: index % 6 === 0, dataQualityFlags: index % 9 === 0 ? ["LATE_EVENT"] : index % 7 === 0 ? ["SPARSE_HISTORY"] : [] }
      },
      create: {
        userId: user.id,
        gradeLevel: `Lớp ${6 + (index % 4)}`,
        learningGoal: studentGoals[index % studentGoals.length],
        weeklyAvailabilityMinutes: [90, 120, 150, 75, 180][index % 5] ?? 120,
        responseSpeed: Number((0.72 + (index % 7) * 0.09).toFixed(2)),
        hintUsageRate: Number((0.08 + (index % 6) * 0.07).toFixed(2)),
        forgettingRate: Number((0.09 + (index % 5) * 0.035).toFixed(3)),
        consistencyScore: Number((0.48 + (index % 8) * 0.06).toFixed(2)),
        engagementLevel: Number((0.5 + ((index * 3) % 8) * 0.055).toFixed(2)),
        xp: 240 + index * 37,
        level: 2 + (index % 5),
        streakDays: 1 + (index % 9),
        metadataJson: { device: devices[index % devices.length], connectivity: index % 7 === 0 ? "UNSTABLE" : index % 5 === 0 ? "OCCASIONAL_OFFLINE" : "STABLE", sharedDevice: index % 6 === 0, dataQualityFlags: index % 9 === 0 ? ["LATE_EVENT"] : index % 7 === 0 ? ["SPARSE_HISTORY"] : [] }
      }
    });
    await prisma.enrollment.upsert({
      where: { studentProfileId_classId_courseId: { studentProfileId: student.id, classId: learningClass.id, courseId: course.id } },
      update: { progress: Number(Math.max(0.08, Math.min(0.82, 0.12 + (index % 8) * 0.075 + (index % 5 === 0 ? -0.05 : 0))).toFixed(3)) },
      create: { studentProfileId: student.id, classId: learningClass.id, courseId: course.id, progress: Number(Math.max(0.08, Math.min(0.82, 0.12 + (index % 8) * 0.075 + (index % 5 === 0 ? -0.05 : 0))).toFixed(3)), metadataJson: { placementCompleted: index !== 18, lastSyncQuality: index % 7 === 0 ? "LATE" : "ON_TIME" } }
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
  console.log("Seeded 1 domain, 1 realistic 6-week course, 1 class, 20 varied students, 8 concepts, 12 lessons, 36 resources and 84 exercises.");
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
