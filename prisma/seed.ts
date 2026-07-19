import "dotenv/config";
import {
  ActivityType,
  ClassTeacherRole,
  ContentSourceStatus,
  ContentSourceType,
  EnrollmentStatus,
  LessonPhase,
  LearningEventStatus,
  Prisma,
  PrismaClient,
  RecordStatus,
  RecommendationAction,
  RecommendationStatus,
  ReviewScheduleStatus,
  UserRole
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const FIXTURE = "pilot-v1";
const FIXED_AT = new Date("2026-06-01T00:00:00.000Z");
const SYNTHETIC_AS_OF = new Date(process.env.SYNTHETIC_DEMO_AS_OF?.trim() || "2026-07-18T12:00:00.000Z");
const LEGACY_DEMO_ADOPTION_ENABLED =
  process.env.ALLOW_LEGACY_DEMO_ADOPTION === "true" && process.env.NODE_ENV !== "production";

type CsvRow = Record<string, string>;
type DomainConcept = { code: string; title: string; description: string; icon: string; order: number };
type DomainPrerequisite = { from: string; to: string; weight: number };
type DomainMisconception = {
  code: string;
  conceptCode: string;
  title: string;
  description: string;
  severity: string;
};
type DomainRule = {
  id: string;
  misconceptionCode: string;
  strategy: string;
  confidence: number;
  evidenceTemplates: string[];
};

function metadata(extra: Prisma.InputJsonObject = {}): Prisma.InputJsonObject {
  return { fixture: FIXTURE, synthetic: true, ...extra };
}

function hasFixture(value: Prisma.JsonValue): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Prisma.JsonObject).fixture === FIXTURE &&
      (value as Prisma.JsonObject).synthetic === true
  );
}

function isKnownLegacyDemoLabel(label: string): boolean {
  return label === "LearningDomain python-foundations"
    || label.startsWith("LearningConcept ")
    || label.startsWith("ConceptPrerequisite ")
    || label.startsWith("Misconception ")
    || label.startsWith("DomainDiagnosisRule ")
    || label === "User teacher@edurecall.local"
    || label === "TeacherProfile teacher@edurecall.local"
    || label === "User minh@edurecall.local"
    || label === "StudentProfile minh@edurecall.local"
    || label === "User lan@edurecall.local"
    || label === "StudentProfile lan@edurecall.local"
    || label.startsWith("StudentConceptState student-01/")
    || label.startsWith("StudentConceptState student-02/");
}

function assertSeedable(row: { metadataJson: Prisma.JsonValue } | null, label: string): void {
  if (!row || hasFixture(row.metadataJson)) return;
  if (LEGACY_DEMO_ADOPTION_ENABLED && isKnownLegacyDemoLabel(label)) return;
  throw new Error(`${label} already exists without ${FIXTURE} fixture metadata; refusing to overwrite it`);
}

function stableUuid(key: string): string {
  const hash = createHash("sha256").update(`edurecall:${FIXTURE}:${key}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

function parseCsv(relativePath: string): CsvRow[] {
  const input = readFileSync(path.join(process.cwd(), relativePath), "utf8").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...data] = rows;
  if (!headers) return [];
  return data.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}

function numberValue(row: CsvRow, key: string): number {
  const value = Number(row[key]);
  if (!Number.isFinite(value)) throw new Error(`Invalid numeric value for ${key}: ${row[key]}`);
  return value;
}

function clamp(value: number, minimum = 0.02, maximum = 0.98): number {
  return Math.min(maximum, Math.max(minimum, value));
}

async function runTransactionBatches(
  operations: Prisma.PrismaPromise<unknown>[],
  batchSize = 100
): Promise<void> {
  for (let index = 0; index < operations.length; index += batchSize) {
    await prisma.$transaction(operations.slice(index, index + batchSize));
  }
}

function assertUnique(rows: CsvRow[], key: (row: CsvRow) => string, label: string): void {
  const values = rows.map(key);
  if (values.some((value) => !value)) throw new Error(`${label} contains an empty key`);
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate keys`);
}

function fixtureDescription(role: "student" | "teacher", index: number): string {
  if (role === "teacher") {
    return [
      "Giảng viên chính: theo dõi lớp và duyệt nội dung AI",
      "Giảng viên phụ: xem tiến độ và hỗ trợ thực hành",
      "Giảng viên phản biện: kiểm tra nguồn và rubric"
    ][index]!;
  }
  return [
    "Học sinh cần luyện tập cá nhân hóa",
    "Học sinh có tốc độ và mục tiêu học khác nhau",
    "Hồ sơ tổng hợp phục vụ demo lớp 20 học sinh"
  ][Math.min(index, 2)]!;
}

const teacherAccounts = [
  { email: "teacher@edurecall.local", displayName: "Cô Mai", avatar: "avatar-24", role: ClassTeacherRole.OWNER },
  { email: "thay.nam@edurecall.local", displayName: "Thầy Nam", avatar: "avatar-23", role: ClassTeacherRole.INSTRUCTOR },
  { email: "co.linh@edurecall.local", displayName: "Cô Linh", avatar: "avatar-22", role: ClassTeacherRole.REVIEWER }
] as const;

const studentEmailSlugs = [
  "minh", "lan", "an", "binh", "chi", "dung", "giang", "ha", "khanh", "linh",
  "mai", "nam", "oanh", "phuc", "quan", "son", "trang", "uyen", "viet", "yen"
];

const moduleDefinitions = [
  { code: "M01-NEN-TANG", title: "Nền tảng Python", description: "Biến, toán tử và điều kiện" },
  { code: "M02-VONG-LAP", title: "Vòng lặp và dữ liệu", description: "For, while và list" },
  { code: "M03-HAM-RANGE", title: "Hàm và range()", description: "Tách logic và hiểu điểm dừng" },
  { code: "M04-DU-AN", title: "Ghép ý tưởng thành chương trình", description: "Thực hành tích hợp có rubric" }
] as const;

const lessonDefinitions = [
  { concept: "PYTHON_VARIABLES", title: "Biến kể câu chuyện dữ liệu" },
  { concept: "PYTHON_OPERATORS", title: "Tính toán và so sánh" },
  { concept: "PYTHON_IF_ELSE", title: "Ra quyết định với if/else" },
  { concept: "PYTHON_FOR", title: "Lặp theo từng phần tử" },
  { concept: "PYTHON_WHILE", title: "Lặp đến khi đạt điều kiện" },
  { concept: "PYTHON_LISTS", title: "Danh sách và chỉ số" },
  { concept: "PYTHON_FUNCTIONS", title: "Đóng gói ý tưởng thành hàm" },
  { concept: "PYTHON_RANGE", title: "Điểm dừng của range()" },
  { concept: "PYTHON_VARIABLES", title: "Mô hình hóa bài toán bằng biến" },
  { concept: "PYTHON_IF_ELSE", title: "Ghép nhánh xử lý" },
  { concept: "PYTHON_FOR", title: "Ghép vòng lặp hoàn chỉnh" },
  { concept: "PYTHON_FUNCTIONS", title: "Dự án chương trình hỏi đáp" }
] as const;

interface DemoTheoryAnimation {
  title: string;
  text: string;
  narration: string;
  animationTemplate: string;
  animationData: Prisma.InputJsonObject;
}

function demoTheoryAnimation(conceptCode: string, conceptTitle: string): DemoTheoryAnimation {
  switch (conceptCode) {
    case "PYTHON_VARIABLES":
      return {
        title: "Giá trị của biến thay đổi như thế nào?",
        text: "Biến là một tên giúp chương trình lưu và cập nhật dữ liệu. Khi có phép gán mới, giá trị cũ được thay bằng giá trị mới.",
        narration: "Hãy xem biến điểm như một chiếc hộp có nhãn. Ban đầu điểm bằng năm. Sau phép gán mới, điểm đổi thành tám, còn tên biến vẫn giữ nguyên.",
        animationTemplate: "VARIABLE_CHANGE",
        animationData: { variable: "diem", before: 5, after: 8 }
      };
    case "PYTHON_OPERATORS":
      return {
        title: "Toán tử biến dữ liệu thành kết quả",
        text: "Toán tử số học tạo ra giá trị mới; toán tử so sánh trả về Đúng hoặc Sai để chương trình có thể ra quyết định.",
        narration: "Dòng đầu cộng bốn với ba để được bảy. Dòng sau so sánh bảy có lớn hơn năm hay không và nhận kết quả đúng.",
        animationTemplate: "CODE_HIGHLIGHT",
        animationData: { lines: ["tong = 4 + 3", "tong > 5", "Kết quả: True"], activeLine: 2 }
      };
    case "PYTHON_IF_ELSE":
      return {
        title: "Chọn đúng một nhánh với if/else",
        text: "Chương trình kiểm tra điều kiện. Nếu điều kiện đúng, nhánh if chạy; nếu sai, nhánh else chạy.",
        narration: "Điều kiện hỏi điểm có từ năm trở lên không. Khi điều kiện đúng, chương trình đi theo nhánh đạt. Nếu sai, chương trình đi theo nhánh cần luyện thêm.",
        animationTemplate: "FLOW_BRANCH",
        animationData: { condition: "điểm >= 5?", truePath: "Đạt", falsePath: "Luyện thêm" }
      };
    case "PYTHON_FOR":
      return {
        title: "Vòng for đi qua từng phần tử",
        text: "Vòng for lấy lần lượt từng phần tử trong một dãy, thực hiện cùng một nhóm lệnh rồi mới chuyển sang phần tử tiếp theo.",
        narration: "Vòng lặp lần lượt đi qua An, Bình và Chi. Mỗi lượt chỉ xử lý một tên, sau ba lượt thì vòng lặp kết thúc.",
        animationTemplate: "LOOP_TIMELINE",
        animationData: { iterations: 3, values: ["An", "Bình", "Chi"] }
      };
    case "PYTHON_RANGE":
      return {
        title: "Dãy số range dừng trước stop",
        text: "range(2, 5) đi qua 2, 3, 4 và dừng ngay trước 5.",
        narration: "Dãy bắt đầu từ hai và dừng ngay trước năm, nên năm không thuộc kết quả.",
        animationTemplate: "NUMBER_SEQUENCE",
        animationData: { start: 2, stop: 5, step: 1, values: ["2", "3", "4"] }
      };
    case "PYTHON_WHILE":
      return {
        title: "While phải tiến về điều kiện dừng",
        text: "Vòng while tiếp tục khi điều kiện còn đúng. Biến điều khiển phải được cập nhật để vòng lặp có thể kết thúc.",
        narration: "Biến lượt bắt đầu bằng một và tăng dần. Mỗi lần cập nhật giúp điều kiện tiến gần hơn tới lúc sai để vòng lặp dừng an toàn.",
        animationTemplate: "VARIABLE_CHANGE",
        animationData: { variable: "luot", before: 1, after: 2 }
      };
    case "PYTHON_LISTS":
      return {
        title: "Chỉ số list bắt đầu từ 0",
        text: "Mỗi phần tử trong list có một chỉ số. Phần tử đầu tiên mang chỉ số 0, phần tử thứ hai mang chỉ số 1.",
        narration: "List có ba phần tử Táo, Cam và Ổi. Chỉ số một đang được chọn nên giá trị nhận được là Cam, phần tử thứ hai trong list.",
        animationTemplate: "LIST_INDEX",
        animationData: { items: ["Táo", "Cam", "Ổi"], activeIndex: 1 }
      };
    case "PYTHON_FUNCTIONS":
      return {
        title: "Hàm nhận đầu vào và trả kết quả",
        text: "Hàm đóng gói các bước xử lý dưới một tên. Dữ liệu đi vào qua tham số và kết quả đi ra bằng giá trị trả về.",
        narration: "Hàm gấp đôi nhận số ba, nhân số đó với hai rồi trả về kết quả sáu. Ta có thể gọi lại hàm với đầu vào khác mà không viết lại logic.",
        animationTemplate: "FUNCTION_FLOW",
        animationData: { input: "3", steps: ["nhận x", "x × 2", "return"], output: "6" }
      };
    default:
      return {
        title: `Minh họa ${conceptTitle}`,
        text: `Quan sát từng bước để hiểu ${conceptTitle}.`,
        narration: `Hãy quan sát minh họa từng bước của ${conceptTitle}.`,
        animationTemplate: "CODE_HIGHLIGHT",
        animationData: { lines: [conceptTitle], activeLine: 1 }
      };
  }
}

function ideaRubric(conceptCode: string): Prisma.InputJsonObject {
  return {
    teacherReviewed: true,
    strategy: "IDEA_RUBRIC",
    rubricVersion: "stable",
    passThreshold: 0.7,
    criteria: [
      {
        id: "identify-data",
        description: "Xác định dữ liệu đầu vào hoặc giá trị khởi tạo cần thiết",
        weight: 0.25,
        aliases: ["nhập", "nhận", "khởi tạo", "gán", "dữ liệu"],
        required: true
      },
      {
        id: "apply-logic",
        description: `Mô tả đúng logic cốt lõi của ${conceptCode}`,
        weight: 0.5,
        aliases: ["kiểm tra", "tính", "lặp", "nếu", "thực hiện", conceptCode.toLowerCase()],
        required: true
      },
      {
        id: "show-result",
        description: "Nêu kết quả đầu ra hoặc cách kết thúc thuật toán",
        weight: 0.25,
        aliases: ["in", "hiển thị", "trả về", "kết quả", "kết thúc"],
        required: true
      }
    ]
  };
}

interface ConceptPracticeTemplate {
  label: string;
  practiceBlocks: string[];
  checkpointBlocks: string[];
  predictCode: string;
  predictAnswers: string[];
  question: string;
  options: [string, string, string];
}

const conceptPracticeTemplates: Record<string, ConceptPracticeTemplate> = {
  PYTHON_VARIABLES: {
    label: "biến và dữ liệu",
    practiceBlocks: ["ten = input(\"Tên của bạn: \")", "loi_chao = \"Chào \" + ten", "print(loi_chao)"],
    checkpointBlocks: ["tuoi = int(input(\"Tuổi hiện tại: \"))", "tuoi_nam_sau = tuoi + 1", "print(tuoi_nam_sau)"],
    predictCode: "so_keo = 1\nso_keo = so_keo + 2\nprint(so_keo)",
    predictAnswers: ["3", "giá trị là 3", "kết quả là 3"],
    question: "Dòng nào lưu số 12 vào biến tuoi?",
    options: ["12 == tuoi", "tuoi = 12", "print(tuoi)"]
  },
  PYTHON_OPERATORS: {
    label: "toán tử tính toán",
    practiceBlocks: ["a = 6", "b = 4", "print(a + b)"],
    checkpointBlocks: ["chieu_dai = 5", "chieu_rong = 3", "dien_tich = chieu_dai * chieu_rong", "print(dien_tich)"],
    predictCode: "phan_du = 7 % 3\nprint(phan_du)",
    predictAnswers: ["1", "phần dư là 1", "kết quả là 1"],
    question: "Toán tử nào nhân hai số trong Python?",
    options: ["+", "*", "%"]
  },
  PYTHON_IF_ELSE: {
    label: "rẽ nhánh if/else",
    practiceBlocks: ["diem = 8", "if diem >= 5:", "    print(\"Đạt\")"],
    checkpointBlocks: ["nhiet_do = 32", "if nhiet_do > 30:", "    print(\"Nóng\")", "else:", "    print(\"Mát\")"],
    predictCode: "tuoi = 12\nif tuoi >= 10:\n    print(\"đủ\")\nelse:\n    print(\"chưa đủ\")",
    predictAnswers: ["đủ", "in đủ", "kết quả là đủ"],
    question: "Khối else chạy khi nào?",
    options: ["Luôn chạy trước if", "Khi điều kiện if sai", "Khi điều kiện if đúng"]
  },
  PYTHON_FOR: {
    label: "vòng lặp for",
    practiceBlocks: ["tong = 0", "for so in [1, 2, 3]:", "    tong = tong + so", "print(tong)"],
    checkpointBlocks: ["cac_ban = [\"An\", \"Bình\"]", "for ban in cac_ban:", "    loi_chao = \"Chào \" + ban", "    print(loi_chao)"],
    predictCode: "tong = 0\nfor so in range(3):\n    tong = tong + so\nprint(tong)",
    predictAnswers: ["3", "tổng là 3", "kết quả là 3"],
    question: "Vòng lặp for phù hợp nhất khi nào?",
    options: ["Khi không có dữ liệu", "Khi cần đi qua từng phần tử", "Khi muốn bỏ qua mọi phần tử"]
  },
  PYTHON_RANGE: {
    label: "dãy số range()",
    practiceBlocks: ["for so in range(1, 4):", "    print(so)", "print(\"Xong\")"],
    checkpointBlocks: ["cac_so = []", "for so in range(2, 5):", "    cac_so.append(so)", "print(cac_so)"],
    predictCode: "cac_so = list(range(2, 5))\nprint(cac_so)",
    predictAnswers: ["2,3,4", "[2, 3, 4]", "2 3 4"],
    question: "range(2, 5) tạo ra dãy nào?",
    options: ["2, 3, 4, 5", "2, 3, 4", "1, 2, 3, 4"]
  },
  PYTHON_WHILE: {
    label: "vòng lặp while",
    practiceBlocks: ["dem = 1", "while dem <= 3:", "    print(dem)", "    dem = dem + 1"],
    checkpointBlocks: ["pin = 3", "while pin > 0:", "    print(pin)", "    pin = pin - 1", "print(\"Hết pin\")"],
    predictCode: "dem = 0\nwhile dem < 3:\n    dem = dem + 1\nprint(dem)",
    predictAnswers: ["3", "đếm là 3", "kết quả là 3"],
    question: "Điều gì giúp vòng while kết thúc an toàn?",
    options: ["Không thay đổi dữ liệu", "Điều kiện dần trở thành sai", "Xóa từ khóa while"]
  },
  PYTHON_LISTS: {
    label: "list và chỉ số",
    practiceBlocks: ["trai_cay = [\"cam\", \"ổi\"]", "mon_dau = trai_cay[0]", "print(mon_dau)"],
    checkpointBlocks: ["diem = [8, 9]", "diem.append(10)", "diem_cuoi = diem[2]", "print(diem_cuoi)"],
    predictCode: "cac_so = [10, 20, 30]\nprint(cac_so[1])",
    predictAnswers: ["20", "giá trị là 20", "kết quả là 20"],
    question: "Chỉ số của phần tử đầu tiên trong list là gì?",
    options: ["1", "0", "-2"]
  },
  PYTHON_FUNCTIONS: {
    label: "hàm cơ bản",
    practiceBlocks: ["def gap_doi(so):", "    return so * 2", "print(gap_doi(3))"],
    checkpointBlocks: ["def loi_chao(ten):", "    thong_diep = \"Chào \" + ten", "    return thong_diep", "print(loi_chao(\"Lan\"))"],
    predictCode: "def binh_phuong(so):\n    return so * so\nprint(binh_phuong(4))",
    predictAnswers: ["16", "giá trị là 16", "kết quả là 16"],
    question: "Từ khóa nào gửi kết quả ra khỏi hàm?",
    options: ["def", "return", "for"]
  }
};

function exerciseContract(lessonNumber: number, exerciseNumber: number, conceptCode: string): {
  type: string;
  phase: LessonPhase;
  prompt: string;
  contentJson: Prisma.InputJsonObject;
  answerJson: Prisma.InputJsonObject;
} {
  const code = `EX-${String(lessonNumber).padStart(2, "0")}-${exerciseNumber}`;
  const template = conceptPracticeTemplates[conceptCode];
  if (!template) throw new Error(`Missing practice template for ${conceptCode}`);
  if (exerciseNumber === 1) {
    return {
      type: "PSEUDOCODE",
      phase: LessonPhase.PRACTICE,
      prompt: `Viết mã giả mô tả cách giải một bài toán bằng ${template.label}. AI phản hồi theo rubric ý tưởng, không chấm cú pháp Python.`,
      contentJson: {
        responseMode: "PSEUDOCODE",
        syntaxPolicy: "IGNORE",
        starterText: "BẮT ĐẦU\n  ...\nKẾT THÚC",
        guidance: "Mô tả các bước; không cần đúng cú pháp Python.",
        conceptCode
      },
      answerJson: ideaRubric(conceptCode)
    };
  }
  if (exerciseNumber === 2) {
    const blockIds = template.practiceBlocks.map((_, index) => `${code}-b${index + 1}`);
    return {
      type: "CODE_ORDER",
      phase: LessonPhase.PRACTICE,
      prompt: "Ghép các khối mã để tạo thành một chương trình hoàn chỉnh.",
      contentJson: {
        responseMode: "CODE_ORDER",
        guidance: "Ghép các khối thành chương trình hoàn chỉnh.",
        blocks: template.practiceBlocks.map((text, index) => ({ id: blockIds[index]!, text })).reverse()
      },
      answerJson: {
        teacherReviewed: true,
        strategy: "CODE_ORDER",
        rubricVersion: "stable",
        acceptedBlockOrders: [blockIds]
      }
    };
  }
  if (exerciseNumber === 3) {
    return {
      type: "MULTIPLE_CHOICE",
      phase: LessonPhase.PRACTICE,
      prompt: template.question,
      contentJson: {
        responseMode: "MULTIPLE_CHOICE",
        options: [
          { id: "A", text: template.options[0] },
          { id: "B", text: template.options[1] },
          { id: "C", text: template.options[2] }
        ]
      },
      answerJson: {
        teacherReviewed: true,
        strategy: "LEGACY_EXACT",
        acceptedAnswers: ["B"],
        expectedAnswer: "B"
      }
    };
  }
  if (exerciseNumber === 4) {
    return {
      type: "PREDICT_OUTPUT",
      phase: LessonPhase.PRACTICE,
      prompt: `Dự đoán kết quả của ví dụ về ${template.label}.`,
      contentJson: {
        responseMode: "TEXT",
        code: template.predictCode,
        guidance: "Chỉ cần nêu kết quả; server đối chiếu answer key đã được giảng viên duyệt."
      },
      answerJson: {
        teacherReviewed: true,
        strategy: "LEGACY_EXACT",
        acceptedAnswers: template.predictAnswers,
        expectedAnswer: template.predictAnswers[0]!,
        ...(conceptCode === "PYTHON_RANGE" ? { stopValue: 5 } : {})
      }
    };
  }
  const checkpointIds = template.checkpointBlocks.map((_, index) => `${code}-b${index + 1}`);
  return {
    type: "CODE_ORDER",
    phase: LessonPhase.CHECKPOINT,
    prompt: `Ghép chương trình hoàn chỉnh vận dụng ${template.label}. Phần kiểm tra này được chấm xác định bằng thứ tự block đã duyệt.`,
    contentJson: {
      responseMode: "CODE_ORDER",
      guidance: "Sắp xếp đủ các khối theo thứ tự chạy của chương trình.",
      blocks: template.checkpointBlocks.map((text, index) => ({ id: checkpointIds[index]!, text })).reverse()
    },
    answerJson: {
      teacherReviewed: true,
      strategy: "CODE_ORDER",
      rubricVersion: "stable",
      acceptedBlockOrders: [checkpointIds]
    }
  };
}

async function seed(): Promise<void> {
  if (process.env.ALLOW_SYNTHETIC_DEMO_SEED !== "true") {
    throw new Error("Synthetic demo seed is disabled. Set ALLOW_SYNTHETIC_DEMO_SEED=true to opt in explicitly.");
  }
  if (process.env.ALLOW_LEGACY_DEMO_ADOPTION === "true" && !LEGACY_DEMO_ADOPTION_ENABLED) {
    throw new Error("Legacy demo adoption is forbidden when NODE_ENV=production");
  }

  const domainDefinition = readJson<Prisma.InputJsonObject>("domains/python-foundations/domain.json");
  const concepts = readJson<DomainConcept[]>("domains/python-foundations/concepts.json");
  const prerequisites = readJson<DomainPrerequisite[]>("domains/python-foundations/prerequisites.json");
  const misconceptions = readJson<DomainMisconception[]>("domains/python-foundations/misconceptions.json");
  const diagnosisRules = readJson<DomainRule[]>("domains/python-foundations/diagnosis-rules.json");
  const studentRows = parseCsv("apps/ai-service/data/synthetic/student_profiles.csv");
  const groundTruthRows = parseCsv("apps/ai-service/data/synthetic/concept_ground_truth.csv");
  const attemptRows = parseCsv("apps/ai-service/data/synthetic/attempts.csv");

  const expected = {
    students: 20,
    concepts: 8,
    prerequisites: 10,
    misconceptions: 10,
    diagnosisRules: 3,
    conceptStates: 160,
    histories: 400
  };
  const actual = {
    students: studentRows.length,
    concepts: concepts.length,
    prerequisites: prerequisites.length,
    misconceptions: misconceptions.length,
    diagnosisRules: diagnosisRules.length,
    conceptStates: groundTruthRows.length,
    histories: attemptRows.length
  };
  for (const [label, count] of Object.entries(expected)) {
    if (actual[label as keyof typeof actual] !== count) {
      throw new Error(`Synthetic input ${label} expected ${count}, found ${actual[label as keyof typeof actual]}`);
    }
  }

  if (!Number.isFinite(SYNTHETIC_AS_OF.getTime()) || SYNTHETIC_AS_OF.getTime() > Date.now()) {
    throw new Error("SYNTHETIC_DEMO_AS_OF must be a valid timestamp that is not in the future");
  }
  assertUnique(studentRows, (row) => row.student_id, "student_profiles.csv");
  assertUnique(groundTruthRows, (row) => `${row.student_id}:${row.concept_code}`, "concept_ground_truth.csv");
  assertUnique(attemptRows, (row) => row.attempt_id, "attempts.csv");
  const studentIds = new Set(studentRows.map((row) => row.student_id));
  const conceptCodes = new Set(concepts.map((concept) => concept.code));
  const sourceAttemptTimes = attemptRows.map((row) => new Date(row.occurred_at).getTime());
  if (sourceAttemptTimes.some((value) => !Number.isFinite(value))) throw new Error("attempts.csv contains an invalid occurred_at timestamp");
  for (const row of [...groundTruthRows, ...attemptRows]) {
    if (!studentIds.has(row.student_id) || !conceptCodes.has(row.concept_code)) {
      throw new Error(`Synthetic row references an unknown student/concept: ${row.student_id}/${row.concept_code}`);
    }
  }
  const sourceLatestAttemptAt = Math.max(...sourceAttemptTimes);
  const attemptTimestampShiftMs = SYNTHETIC_AS_OF.getTime() - sourceLatestAttemptAt;
  const attemptDate = (row: CsvRow): Date => new Date(new Date(row.occurred_at).getTime() + attemptTimestampShiftMs);

  const password = process.env.DEMO_ACCOUNT_PASSWORD?.trim() || "Demo@123";
  if (password.length < 8) throw new Error("DEMO_ACCOUNT_PASSWORD must contain at least 8 characters");
  const passwordHash = await bcrypt.hash(password, 12);

  const existingOrganization = await prisma.organization.findUnique({ where: { code: "STEAM-VIETNAM-DEMO" } });
  assertSeedable(existingOrganization, "Organization STEAM-VIETNAM-DEMO");
  const organization = await prisma.organization.upsert({
    where: { code: "STEAM-VIETNAM-DEMO" },
    create: {
      code: "STEAM-VIETNAM-DEMO",
      name: "STEAM for Vietnam — lớp demo tổng hợp",
      status: RecordStatus.ACTIVE,
      metadataJson: metadata({ scope: "one-course-one-class-20-learners" })
    },
    update: {
      name: "STEAM for Vietnam — lớp demo tổng hợp",
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      metadataJson: metadata({ scope: "one-course-one-class-20-learners" })
    }
  });

  const existingDomain = await prisma.learningDomain.findUnique({ where: { code: "python-foundations" } });
  assertSeedable(existingDomain, "LearningDomain python-foundations");
  const domain = await prisma.learningDomain.upsert({
    where: { code: "python-foundations" },
    create: {
      code: "python-foundations",
      name: "Python cơ bản cho học sinh",
      locale: "vi-VN",
      version: "1.0.0",
      definitionJson: domainDefinition,
      status: RecordStatus.ACTIVE,
      metadataJson: metadata({ source: "domains/python-foundations" })
    },
    update: {
      name: "Python cơ bản cho học sinh",
      locale: "vi-VN",
      version: "1.0.0",
      definitionJson: domainDefinition,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      metadataJson: metadata({ source: "domains/python-foundations" })
    }
  });

  const conceptByCode = new Map<string, { id: string; code: string; title: string }>();
  for (const definition of concepts) {
    const current = await prisma.learningConcept.findUnique({
      where: { domainId_code: { domainId: domain.id, code: definition.code } }
    });
    assertSeedable(current, `LearningConcept ${definition.code}`);
    const concept = await prisma.learningConcept.upsert({
      where: { domainId_code: { domainId: domain.id, code: definition.code } },
      create: {
        domainId: domain.id,
        code: definition.code,
        title: definition.title,
        description: definition.description,
        iconAssetKey: definition.icon,
        order: definition.order,
        status: RecordStatus.ACTIVE,
        metadataJson: metadata({ source: "domains/python-foundations/concepts.json" })
      },
      update: {
        title: definition.title,
        description: definition.description,
        iconAssetKey: definition.icon,
        order: definition.order,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        metadataJson: metadata({ source: "domains/python-foundations/concepts.json" })
      }
    });
    conceptByCode.set(concept.code, concept);
  }

  for (const definition of prerequisites) {
    const prerequisite = conceptByCode.get(definition.from);
    const target = conceptByCode.get(definition.to);
    if (!prerequisite || !target) throw new Error(`Unknown prerequisite edge ${definition.from} -> ${definition.to}`);
    const key = { prerequisiteConceptId_targetConceptId: { prerequisiteConceptId: prerequisite.id, targetConceptId: target.id } };
    const current = await prisma.conceptPrerequisite.findUnique({ where: key });
    assertSeedable(current, `ConceptPrerequisite ${definition.from} -> ${definition.to}`);
    await prisma.conceptPrerequisite.upsert({
      where: key,
      create: {
        prerequisiteConceptId: prerequisite.id,
        targetConceptId: target.id,
        weight: definition.weight,
        metadataJson: metadata({ source: "domains/python-foundations/prerequisites.json" })
      },
      update: {
        weight: definition.weight,
        metadataJson: metadata({ source: "domains/python-foundations/prerequisites.json" })
      }
    });
  }

  const misconceptionByCode = new Map<string, { id: string }>();
  for (const definition of misconceptions) {
    const concept = conceptByCode.get(definition.conceptCode);
    if (!concept) throw new Error(`Unknown misconception concept ${definition.conceptCode}`);
    const current = await prisma.misconception.findUnique({
      where: { domainId_code: { domainId: domain.id, code: definition.code } }
    });
    assertSeedable(current, `Misconception ${definition.code}`);
    const misconception = await prisma.misconception.upsert({
      where: { domainId_code: { domainId: domain.id, code: definition.code } },
      create: {
        domainId: domain.id,
        conceptId: concept.id,
        code: definition.code,
        title: definition.title,
        description: definition.description,
        severity: definition.severity,
        status: RecordStatus.ACTIVE,
        metadataJson: metadata({ source: "domains/python-foundations/misconceptions.json" })
      },
      update: {
        conceptId: concept.id,
        title: definition.title,
        description: definition.description,
        severity: definition.severity,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        metadataJson: metadata({ source: "domains/python-foundations/misconceptions.json" })
      }
    });
    misconceptionByCode.set(definition.code, misconception);
  }
  for (const definition of diagnosisRules) {
    const misconception = misconceptionByCode.get(definition.misconceptionCode);
    if (!misconception) throw new Error(`Unknown diagnosis misconception ${definition.misconceptionCode}`);
    const key = { domainId_code_version: { domainId: domain.id, code: definition.id, version: 1 } };
    const current = await prisma.domainDiagnosisRule.findUnique({ where: key });
    assertSeedable(current, `DomainDiagnosisRule ${definition.id}`);
    await prisma.domainDiagnosisRule.upsert({
      where: key,
      create: {
        domainId: domain.id,
        misconceptionId: misconception.id,
        code: definition.id,
        strategy: definition.strategy,
        confidence: definition.confidence,
        definitionJson: { evidenceTemplates: definition.evidenceTemplates },
        version: 1,
        status: RecordStatus.ACTIVE,
        metadataJson: metadata({ source: "domains/python-foundations/diagnosis-rules.json" })
      },
      update: {
        misconceptionId: misconception.id,
        strategy: definition.strategy,
        confidence: definition.confidence,
        definitionJson: { evidenceTemplates: definition.evidenceTemplates },
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        metadataJson: metadata({ source: "domains/python-foundations/diagnosis-rules.json" })
      }
    });
  }

  const teacherProfiles: Array<{ id: string; userId: string; role: ClassTeacherRole }> = [];
  for (const [index, account] of teacherAccounts.entries()) {
    const existingUser = await prisma.user.findUnique({ where: { email: account.email } });
    assertSeedable(existingUser, `User ${account.email}`);
    const existingHashMatches = existingUser ? await bcrypt.compare(password, existingUser.passwordHash) : false;
    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: {
        email: account.email,
        passwordHash,
        role: UserRole.TEACHER,
        displayName: account.displayName,
        avatarKey: account.avatar,
        status: RecordStatus.ACTIVE,
        metadataJson: metadata({ demoAccount: true, description: fixtureDescription("teacher", index) })
      },
      update: {
        passwordHash: existingHashMatches ? existingUser!.passwordHash : passwordHash,
        role: UserRole.TEACHER,
        displayName: account.displayName,
        avatarKey: account.avatar,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        metadataJson: metadata({ demoAccount: true, description: fixtureDescription("teacher", index) })
      }
    });
    const existingProfile = await prisma.teacherProfile.findUnique({ where: { userId: user.id } });
    assertSeedable(existingProfile, `TeacherProfile ${account.email}`);
    const profile = await prisma.teacherProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        bio: fixtureDescription("teacher", index),
        specialization: index === 2 ? "AI grounding và phản biện nội dung" : "Tin học K-12",
        status: RecordStatus.ACTIVE,
        metadataJson: metadata({ demoAccount: true })
      },
      update: {
        bio: fixtureDescription("teacher", index),
        specialization: index === 2 ? "AI grounding và phản biện nội dung" : "Tin học K-12",
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        metadataJson: metadata({ demoAccount: true })
      }
    });
    teacherProfiles.push({ id: profile.id, userId: user.id, role: account.role });
  }

  const existingCourse = await prisma.course.findUnique({
    where: { organizationId_code: { organizationId: organization.id, code: "PYTHON-FOUNDATIONS-DEMO" } }
  });
  assertSeedable(existingCourse, "Course PYTHON-FOUNDATIONS-DEMO");
  const course = await prisma.course.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "PYTHON-FOUNDATIONS-DEMO" } },
    create: {
      organizationId: organization.id,
      domainId: domain.id,
      code: "PYTHON-FOUNDATIONS-DEMO",
      title: "Python cơ bản — học qua ý tưởng và ghép mã",
      description: "Khóa demo tổng hợp 12 bài, chấm mã giả theo ý tưởng và thực hành ghép mã.",
      coverAssetKey: "course-python-foundations",
      estimatedHours: 12,
      status: RecordStatus.ACTIVE,
      metadataJson: metadata({ pilot: "one-course-one-class" })
    },
    update: {
      domainId: domain.id,
      title: "Python cơ bản — học qua ý tưởng và ghép mã",
      description: "Khóa demo tổng hợp 12 bài, chấm mã giả theo ý tưởng và thực hành ghép mã.",
      coverAssetKey: "course-python-foundations",
      estimatedHours: 12,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      metadataJson: metadata({ pilot: "one-course-one-class" })
    }
  });

  const existingClass = await prisma.learningClass.findUnique({
    where: { organizationId_code: { organizationId: organization.id, code: "PYTHON-PILOT-01" } }
  });
  assertSeedable(existingClass, "Class PYTHON-PILOT-01");
  const learningClass = await prisma.learningClass.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "PYTHON-PILOT-01" } },
    create: {
      organizationId: organization.id,
      teacherId: teacherProfiles[0]!.id,
      code: "PYTHON-PILOT-01",
      name: "Lớp Python thí điểm — 20 học sinh",
      leaderboardEnabled: true,
      status: RecordStatus.ACTIVE,
      metadataJson: metadata({ primaryDemoClass: true })
    },
    update: {
      teacherId: teacherProfiles[0]!.id,
      name: "Lớp Python thí điểm — 20 học sinh",
      leaderboardEnabled: true,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      metadataJson: metadata({ primaryDemoClass: true })
    }
  });

  for (const profile of teacherProfiles) {
    const key = { classId_teacherProfileId: { classId: learningClass.id, teacherProfileId: profile.id } };
    const current = await prisma.classTeacherMembership.findUnique({ where: key });
    assertSeedable(current, `ClassTeacherMembership ${learningClass.code}/${profile.id}`);
    await prisma.classTeacherMembership.upsert({
      where: key,
      create: {
        classId: learningClass.id,
        teacherProfileId: profile.id,
        role: profile.role,
        status: RecordStatus.ACTIVE,
        metadataJson: metadata({ demoAccount: true })
      },
      update: {
        role: profile.role,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        metadataJson: metadata({ demoAccount: true })
      }
    });
  }

  const moduleIds: string[] = [];
  for (const [index, definition] of moduleDefinitions.entries()) {
    const key = { courseId_code: { courseId: course.id, code: definition.code } };
    const current = await prisma.courseModule.findUnique({ where: key });
    assertSeedable(current, `CourseModule ${definition.code}`);
    const moduleRow = await prisma.courseModule.upsert({
      where: key,
      create: {
        courseId: course.id,
        code: definition.code,
        title: definition.title,
        description: definition.description,
        order: index + 1,
        status: RecordStatus.ACTIVE,
        metadataJson: metadata()
      },
      update: {
        title: definition.title,
        description: definition.description,
        order: index + 1,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        metadataJson: metadata()
      }
    });
    moduleIds.push(moduleRow.id);
  }

  const exerciseByConcept = new Map<string, { id: string; code: string; phase: LessonPhase; difficulty: number }>();
  for (const [lessonIndex, definition] of lessonDefinitions.entries()) {
    const lessonNumber = lessonIndex + 1;
    const moduleIndex = Math.floor(lessonIndex / 3);
    const moduleId = moduleIds[moduleIndex]!;
    const concept = conceptByCode.get(definition.concept);
    if (!concept) throw new Error(`Unknown lesson concept ${definition.concept}`);
    const lessonCode = `L${String(lessonNumber).padStart(2, "0")}`;
    const key = { moduleId_code: { moduleId, code: lessonCode } };
    const current = await prisma.lesson.findUnique({ where: key });
    assertSeedable(current, `Lesson ${lessonCode}`);
    const lesson = await prisma.lesson.upsert({
      where: key,
      create: {
        moduleId,
        conceptId: concept.id,
        code: lessonCode,
        title: definition.title,
        summary: `Học ${concept.title} bằng ví dụ, mã giả và bài ghép mã.`,
        order: (lessonIndex % 3) + 1,
        durationMinutes: 35,
        status: RecordStatus.ACTIVE,
        metadataJson: metadata({ teacherReviewed: true })
      },
      update: {
        conceptId: concept.id,
        title: definition.title,
        summary: `Học ${concept.title} bằng ví dụ, mã giả và bài ghép mã.`,
        order: (lessonIndex % 3) + 1,
        durationMinutes: 35,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        metadataJson: metadata({ teacherReviewed: true })
      }
    });

    const theoryAnimation = demoTheoryAnimation(concept.code, concept.title);
    const resources = [
      {
        type: "ANIMATION",
        phase: LessonPhase.THEORY,
        title: theoryAnimation.title,
        contentJson: {
          kind: "explanation",
          conceptCode: concept.code,
          text: theoryAnimation.text,
          animationTemplate: theoryAnimation.animationTemplate,
          animationData: theoryAnimation.animationData,
          narration: theoryAnimation.narration
        }
      },
      {
        type: "WORKED_EXAMPLE",
        phase: LessonPhase.PRACTICE,
        title: "Ví dụ từng bước",
        contentJson: { kind: "worked-example", steps: ["Xác định dữ liệu", "Áp dụng logic", "Kiểm tra kết quả"] }
      },
      {
        type: "CHECKLIST",
        phase: LessonPhase.CHECKPOINT,
        title: "Tự kiểm tra trước khi nộp",
        contentJson: { kind: "checklist", items: ["Ý tưởng đủ bước", "Kết quả rõ ràng", "Không cần đúng cú pháp"] }
      }
    ] as const;
    for (const [resourceIndex, definitionResource] of resources.entries()) {
      const id = stableUuid(`resource:${lessonCode}:${resourceIndex + 1}`);
      const existingResource = await prisma.learningResource.findUnique({ where: { id } });
      assertSeedable(existingResource, `LearningResource ${lessonCode}/${resourceIndex + 1}`);
      await prisma.learningResource.upsert({
        where: { id },
        create: {
          id,
          lessonId: lesson.id,
          ...definitionResource,
          status: RecordStatus.ACTIVE,
          metadataJson: metadata({ teacherReviewed: true })
        },
        update: {
          lessonId: lesson.id,
          ...definitionResource,
          status: RecordStatus.ACTIVE,
          deletedAt: null,
          metadataJson: metadata({ teacherReviewed: true })
        }
      });
    }

    for (let exerciseNumber = 1; exerciseNumber <= 5; exerciseNumber += 1) {
      const exerciseCode = `EX-${String(lessonNumber).padStart(2, "0")}-${exerciseNumber}`;
      const contract = exerciseContract(lessonNumber, exerciseNumber, concept.code);
      const exerciseKey = { lessonId_code: { lessonId: lesson.id, code: exerciseCode } };
      const existingExercise = await prisma.exercise.findUnique({ where: exerciseKey });
      assertSeedable(existingExercise, `Exercise ${exerciseCode}`);
      const exercise = await prisma.exercise.upsert({
        where: exerciseKey,
        create: {
          lessonId: lesson.id,
          code: exerciseCode,
          type: contract.type,
          phase: contract.phase,
          prompt: contract.prompt,
          difficulty: clamp(0.3 + lessonIndex * 0.025 + exerciseNumber * 0.035, 0.25, 0.85),
          contentJson: contract.contentJson,
          answerJson: contract.answerJson,
          status: RecordStatus.ACTIVE,
          metadataJson: metadata({ teacherReviewed: true, contractVersion: "exercise-grader-v1" })
        },
        update: {
          type: contract.type,
          phase: contract.phase,
          prompt: contract.prompt,
          difficulty: clamp(0.3 + lessonIndex * 0.025 + exerciseNumber * 0.035, 0.25, 0.85),
          contentJson: contract.contentJson,
          answerJson: contract.answerJson,
          status: RecordStatus.ACTIVE,
          deletedAt: null,
          metadataJson: metadata({ teacherReviewed: true, contractVersion: "exercise-grader-v1" })
        }
      });
      await prisma.exerciseConcept.upsert({
        where: { exerciseId_conceptId: { exerciseId: exercise.id, conceptId: concept.id } },
        create: { exerciseId: exercise.id, conceptId: concept.id, weight: 1, isPrimary: true },
        update: { weight: 1, isPrimary: true }
      });
      if (exerciseNumber === 4 && !exerciseByConcept.has(concept.code)) {
        exerciseByConcept.set(concept.code, {
          id: exercise.id,
          code: exercise.code,
          phase: exercise.phase,
          difficulty: exercise.difficulty
        });
      }
    }
  }

  const sourceText = [
    "Nguồn đã được giảng viên xác minh cho khóa Python cơ bản tổng hợp.",
    "Mã giả được đánh giá theo các bước tư duy, không dùng lỗi cú pháp làm điều kiện loại.",
    "Bài ghép mã yêu cầu học sinh sắp xếp đủ các khối thành một chương trình hoàn chỉnh."
  ];
  const extractedText = sourceText.join("\n\n");
  const checksum = createHash("sha256").update(extractedText).digest("hex");
  const sourceKey = { courseId_checksum: { courseId: course.id, checksum } };
  const existingSource = await prisma.contentSource.findUnique({ where: sourceKey });
  assertSeedable(existingSource, "ContentSource reviewed-demo-source");
  const source = await prisma.contentSource.upsert({
    where: sourceKey,
    create: {
      courseId: course.id,
      uploadedById: teacherProfiles[0]!.userId,
      name: "Nguồn chuẩn Python cơ bản — demo tổng hợp",
      type: ContentSourceType.TXT,
      mimeType: "text/plain; charset=utf-8",
      sizeBytes: Buffer.byteLength(extractedText, "utf8"),
      checksum,
      extractedText,
      status: ContentSourceStatus.VERIFIED,
      verifiedAt: FIXED_AT,
      metadataJson: metadata({ teacherReviewed: true, directIdentifiers: false })
    },
    update: {
      uploadedById: teacherProfiles[0]!.userId,
      name: "Nguồn chuẩn Python cơ bản — demo tổng hợp",
      type: ContentSourceType.TXT,
      mimeType: "text/plain; charset=utf-8",
      sizeBytes: Buffer.byteLength(extractedText, "utf8"),
      extractedText,
      status: ContentSourceStatus.VERIFIED,
      verifiedAt: FIXED_AT,
      deletedAt: null,
      metadataJson: metadata({ teacherReviewed: true, directIdentifiers: false })
    }
  });
  for (const [chunkIndex, text] of sourceText.entries()) {
    const current = await prisma.sourceChunk.findUnique({
      where: { sourceId_chunkIndex: { sourceId: source.id, chunkIndex } }
    });
    assertSeedable(current, `SourceChunk ${chunkIndex}`);
    await prisma.sourceChunk.upsert({
      where: { sourceId_chunkIndex: { sourceId: source.id, chunkIndex } },
      create: {
        sourceId: source.id,
        chunkIndex,
        text,
        tokenCount: text.split(/\s+/).length,
        metadataJson: metadata({ grounded: true })
      },
      update: {
        text,
        tokenCount: text.split(/\s+/).length,
        metadataJson: metadata({ grounded: true })
      }
    });
  }

  const studentProfileBySyntheticId = new Map<string, { id: string; userId: string; forgettingRate: number }>();
  for (const [index, row] of studentRows.entries()) {
    const syntheticId = row.student_id;
    const emailSlug = studentEmailSlugs[index];
    if (!syntheticId || !emailSlug) throw new Error(`Student row ${index + 1} is incomplete`);
    const email = `${emailSlug}@edurecall.local`;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    assertSeedable(existingUser, `User ${email}`);
    const existingHashMatches = existingUser ? await bcrypt.compare(password, existingUser.passwordHash) : false;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        role: UserRole.STUDENT,
        displayName: row.name,
        nickname: row.name,
        avatarKey: `avatar-${String(index + 1).padStart(2, "0")}`,
        status: RecordStatus.ACTIVE,
        metadataJson: metadata({
          demoAccount: true,
          syntheticStudentId: syntheticId,
          description: fixtureDescription("student", index),
          dataNotice: "SYNTHETIC DATA — NOT REAL EDUONE DATA"
        })
      },
      update: {
        passwordHash: existingHashMatches ? existingUser!.passwordHash : passwordHash,
        role: UserRole.STUDENT,
        displayName: row.name,
        nickname: row.name,
        avatarKey: `avatar-${String(index + 1).padStart(2, "0")}`,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        metadataJson: metadata({
          demoAccount: true,
          syntheticStudentId: syntheticId,
          description: fixtureDescription("student", index),
          dataNotice: "SYNTHETIC DATA — NOT REAL EDUONE DATA"
        })
      }
    });
    const existingProfile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    assertSeedable(existingProfile, `StudentProfile ${email}`);
    const profile = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        gradeLevel: row.grade_level,
        learningGoal: row.learning_goal,
        weeklyAvailabilityMinutes: numberValue(row, "weekly_availability_minutes"),
        responseSpeed: numberValue(row, "response_speed"),
        hintUsageRate: numberValue(row, "hint_usage_rate"),
        forgettingRate: numberValue(row, "forgetting_rate"),
        consistencyScore: numberValue(row, "consistency_score"),
        engagementLevel: numberValue(row, "engagement_level"),
        xp: 120 + index * 17,
        level: 1 + Math.floor(index / 5),
        streakDays: index % 8,
        status: RecordStatus.ACTIVE,
        metadataJson: metadata({
          persona: row.persona,
          connectivity: row.connectivity,
          deviceType: row.device_type,
          sharedDevice: row.shared_device === "1",
          preferredSessionMinutes: numberValue(row, "preferred_session_minutes"),
          placementCompleted: row.placement_completed === "1",
          dataQualityFlags: row.profile_quality_flags ? row.profile_quality_flags.split("|") : [],
          source: "apps/ai-service/data/synthetic/student_profiles.csv"
        })
      },
      update: {
        gradeLevel: row.grade_level,
        learningGoal: row.learning_goal,
        weeklyAvailabilityMinutes: numberValue(row, "weekly_availability_minutes"),
        responseSpeed: numberValue(row, "response_speed"),
        hintUsageRate: numberValue(row, "hint_usage_rate"),
        forgettingRate: numberValue(row, "forgetting_rate"),
        consistencyScore: numberValue(row, "consistency_score"),
        engagementLevel: numberValue(row, "engagement_level"),
        xp: 120 + index * 17,
        level: 1 + Math.floor(index / 5),
        streakDays: index % 8,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        metadataJson: metadata({
          persona: row.persona,
          connectivity: row.connectivity,
          deviceType: row.device_type,
          sharedDevice: row.shared_device === "1",
          preferredSessionMinutes: numberValue(row, "preferred_session_minutes"),
          placementCompleted: row.placement_completed === "1",
          dataQualityFlags: row.profile_quality_flags ? row.profile_quality_flags.split("|") : [],
          source: "apps/ai-service/data/synthetic/student_profiles.csv"
        })
      }
    });
    studentProfileBySyntheticId.set(syntheticId, {
      id: profile.id,
      userId: user.id,
      forgettingRate: profile.forgettingRate
    });
    const enrollmentKey = {
      studentProfileId_classId_courseId: {
        studentProfileId: profile.id,
        classId: learningClass.id,
        courseId: course.id
      }
    };
    const existingEnrollment = await prisma.enrollment.findUnique({ where: enrollmentKey });
    assertSeedable(existingEnrollment, `Enrollment ${syntheticId}`);
    await prisma.enrollment.upsert({
      where: enrollmentKey,
      create: {
        studentProfileId: profile.id,
        classId: learningClass.id,
        courseId: course.id,
        status: EnrollmentStatus.ACTIVE,
        progress: clamp(0.18 + index * 0.025, 0.18, 0.72),
        enrolledAt: FIXED_AT,
        metadataJson: metadata({ syntheticStudentId: syntheticId, primaryLearningContext: true })
      },
      update: {
        status: EnrollmentStatus.ACTIVE,
        progress: clamp(0.18 + index * 0.025, 0.18, 0.72),
        deletedAt: null,
        metadataJson: metadata({ syntheticStudentId: syntheticId, primaryLearningContext: true })
      }
    });
  }

  const attemptsByPair = new Map<string, CsvRow[]>();
  for (const row of attemptRows) {
    const key = `${row.student_id}:${row.concept_code}`;
    attemptsByPair.set(key, [...(attemptsByPair.get(key) ?? []), row]);
  }
  for (const rows of attemptsByPair.values()) {
    rows.sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
  }

  const syntheticIdByProfileId = new Map(
    [...studentProfileBySyntheticId.entries()].map(([syntheticId, profile]) => [profile.id, syntheticId] as const)
  );
  const conceptCodeById = new Map([...conceptByCode.values()].map((concept) => [concept.id, concept.code] as const));
  const existingStateRows = await prisma.studentConceptState.findMany({
    where: {
      studentProfileId: { in: [...syntheticIdByProfileId.keys()] },
      conceptId: { in: [...conceptCodeById.keys()] }
    },
    select: { studentProfileId: true, conceptId: true, metadataJson: true }
  });
  for (const existingState of existingStateRows) {
    const syntheticId = syntheticIdByProfileId.get(existingState.studentProfileId) ?? "unknown-student";
    const conceptCode = conceptCodeById.get(existingState.conceptId) ?? "unknown-concept";
    assertSeedable(existingState, `StudentConceptState ${syntheticId}/${conceptCode}`);
  }

  const stateOperations = groundTruthRows.map((row) => {
    const profile = studentProfileBySyntheticId.get(row.student_id);
    const concept = conceptByCode.get(row.concept_code);
    if (!profile || !concept) throw new Error(`Unknown concept-state pair ${row.student_id}/${row.concept_code}`);
    const mastery = clamp(numberValue(row, "latent_ability"));
    const pairAttempts = attemptsByPair.get(`${row.student_id}:${row.concept_code}`) ?? [];
    const lastAttempt = pairAttempts.at(-1);
    const lastPracticedAt = lastAttempt ? attemptDate(lastAttempt) : FIXED_AT;
    const retrievability = clamp(mastery - profile.forgettingRate * 0.18);
    const stateKey = {
      studentProfileId_conceptId: { studentProfileId: profile.id, conceptId: concept.id }
    };
    return prisma.studentConceptState.upsert({
      where: stateKey,
      create: {
        studentProfileId: profile.id,
        conceptId: concept.id,
        mastery,
        stability: clamp(2 + mastery * 7, 1, 10),
        retrievability,
        forgettingRisk: 1 - retrievability,
        nextAttemptProbability: clamp(mastery * 0.86 + retrievability * 0.14),
        modelVersion: "synthetic-ground-truth-v1",
        lastPracticedAt,
        metadataJson: metadata({
          syntheticGroundTruth: true,
          source: "apps/ai-service/data/synthetic/concept_ground_truth.csv",
          snapshotAsOf: SYNTHETIC_AS_OF.toISOString(),
          modelSnapshotOnly: true,
          educationalImpactEvidence: false
        })
      },
      update: {
        mastery,
        stability: clamp(2 + mastery * 7, 1, 10),
        retrievability,
        forgettingRisk: 1 - retrievability,
        nextAttemptProbability: clamp(mastery * 0.86 + retrievability * 0.14),
        modelVersion: "synthetic-ground-truth-v1",
        lastPracticedAt,
        metadataJson: metadata({
          syntheticGroundTruth: true,
          source: "apps/ai-service/data/synthetic/concept_ground_truth.csv",
          snapshotAsOf: SYNTHETIC_AS_OF.toISOString(),
          modelSnapshotOnly: true,
          educationalImpactEvidence: false
        })
      }
    });
  });
  await runTransactionBatches(stateOperations);

  const groundTruthByPair = new Map<string, number>(
    groundTruthRows.map((row) => [
      `${row.student_id}:${row.concept_code}`,
      numberValue(row, "latent_ability")
    ] as const)
  );
  const pairPosition = new Map<string, number>();
  const historySpecs = attemptRows.map((row) => {
    const profile = studentProfileBySyntheticId.get(row.student_id);
    const concept = conceptByCode.get(row.concept_code);
    if (!profile || !concept) throw new Error(`Unknown history pair ${row.student_id}/${row.concept_code}`);
    const pairKey = `${row.student_id}:${row.concept_code}`;
    const position = pairPosition.get(pairKey) ?? 0;
    pairPosition.set(pairKey, position + 1);
    const pairCount = attemptsByPair.get(pairKey)?.length ?? 1;
    const progress = (position + 1) / pairCount;
    const target = groundTruthByPair.get(pairKey) ?? numberValue(row, "latent_ability");
    const baseline = clamp(target - 0.16);
    const correctnessAdjustment = row.is_correct === "1" ? 0.04 : -0.04;
    const mastery = clamp(baseline + (target - baseline) * progress + correctnessAdjustment * (1 - progress));
    const retrievability = clamp(0.58 + mastery * 0.35 - numberValue(row, "days_since_last_practice") * 0.015);
    const historyId = stableUuid(`concept-history:${row.attempt_id}`);
    return { row, profile, concept, progress, target, mastery, retrievability, historyId };
  });
  const attemptIdByHistoryId = new Map(historySpecs.map((spec) => [spec.historyId, spec.row.attempt_id] as const));
  const existingHistories = await prisma.conceptStateHistory.findMany({
    where: { id: { in: [...attemptIdByHistoryId.keys()] } },
    select: { id: true, metadataJson: true }
  });
  for (const existingHistory of existingHistories) {
    assertSeedable(existingHistory, `ConceptStateHistory ${attemptIdByHistoryId.get(existingHistory.id) ?? existingHistory.id}`);
  }
  const historyOperations = historySpecs.map(({ row, profile, concept, progress, target, mastery, retrievability, historyId }) =>
    prisma.conceptStateHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        studentProfileId: profile.id,
        conceptId: concept.id,
        mastery,
        stability: clamp(1.2 + progress * 6 + target * 2, 1, 10),
        retrievability,
        forgettingRisk: 1 - retrievability,
        modelVersion: "synthetic-attempt-replay-v1",
        recordedAt: attemptDate(row),
        metadataJson: metadata({
          syntheticAttemptId: row.attempt_id,
          sourceOccurredAt: row.occurred_at,
          snapshotAsOf: SYNTHETIC_AS_OF.toISOString(),
          modelSnapshotOnly: true,
          linkedLearningEvent: false,
          isCorrect: row.is_correct === "1",
          usedHint: row.used_hint === "1",
          source: "apps/ai-service/data/synthetic/attempts.csv",
          educationalImpactEvidence: false
        })
      },
      update: {
        studentProfileId: profile.id,
        conceptId: concept.id,
        mastery,
        stability: clamp(1.2 + progress * 6 + target * 2, 1, 10),
        retrievability,
        forgettingRisk: 1 - retrievability,
        modelVersion: "synthetic-attempt-replay-v1",
        recordedAt: attemptDate(row),
        metadataJson: metadata({
          syntheticAttemptId: row.attempt_id,
          sourceOccurredAt: row.occurred_at,
          snapshotAsOf: SYNTHETIC_AS_OF.toISOString(),
          modelSnapshotOnly: true,
          linkedLearningEvent: false,
          isCorrect: row.is_correct === "1",
          usedHint: row.used_hint === "1",
          source: "apps/ai-service/data/synthetic/attempts.csv",
          educationalImpactEvidence: false
        })
      }
    })
  );
  await runTransactionBatches(historyOperations);

  for (const [index, studentRow] of studentRows.entries()) {
    const profile = studentProfileBySyntheticId.get(studentRow.student_id);
    const sourceAttempt = attemptRows
      .filter((row) => row.student_id === studentRow.student_id)
      .sort((left, right) => left.occurred_at.localeCompare(right.occurred_at))
      .at(-1);
    if (!profile || !sourceAttempt) throw new Error(`Cannot build linked demo evidence for ${studentRow.student_id}`);
    const concept = conceptByCode.get(sourceAttempt.concept_code);
    const exercise = exerciseByConcept.get(sourceAttempt.concept_code);
    if (!concept || !exercise) throw new Error(`No reviewed exercise for linked evidence ${sourceAttempt.concept_code}`);
    const interactionAt = index < 5
      ? new Date(Date.now() - index * 60_000)
      : attemptDate(sourceAttempt);
    const eventId = stableUuid(`linked-event:${studentRow.student_id}`);
    const eventKey = `fixture-${FIXTURE}-${studentRow.student_id}`;
    const existingEvent = await prisma.learningEvent.findUnique({ where: { id: eventId } });
    assertSeedable(existingEvent, `LearningEvent ${studentRow.student_id}`);
    const event = await prisma.learningEvent.upsert({
      where: { id: eventId },
      create: {
        id: eventId,
        idempotencyKey: eventKey,
        userId: profile.userId,
        courseId: course.id,
        type: ActivityType.EXERCISE,
        status: LearningEventStatus.ANALYZED,
        occurredAt: interactionAt,
        analyzedAt: interactionAt,
        correlationId: stableUuid(`linked-correlation:${studentRow.student_id}`),
        payloadJson: {
          sourceAttemptId: sourceAttempt.attempt_id,
          source: "apps/ai-service/data/synthetic/attempts.csv"
        },
        metadataJson: metadata({ linkedDemoEvidence: true, educationalImpactEvidence: false }),
        createdAt: interactionAt
      },
      update: {
        idempotencyKey: eventKey,
        userId: profile.userId,
        courseId: course.id,
        type: ActivityType.EXERCISE,
        status: LearningEventStatus.ANALYZED,
        occurredAt: interactionAt,
        analyzedAt: interactionAt,
        payloadJson: {
          sourceAttemptId: sourceAttempt.attempt_id,
          source: "apps/ai-service/data/synthetic/attempts.csv"
        },
        metadataJson: metadata({ linkedDemoEvidence: true, educationalImpactEvidence: false }),
        createdAt: interactionAt
      }
    });
    const attemptId = stableUuid(`linked-attempt:${studentRow.student_id}`);
    const existingAttempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
    assertSeedable(existingAttempt, `Attempt ${studentRow.student_id}`);
    const isCorrect = sourceAttempt.is_correct === "1";
    const attempt = await prisma.attempt.upsert({
      where: { id: attemptId },
      create: {
        id: attemptId,
        eventId: event.id,
        userId: profile.userId,
        exerciseId: exercise.id,
        isCorrect,
        usedHint: sourceAttempt.used_hint === "1",
        skipped: sourceAttempt.skipped === "1",
        attemptNumber: Math.max(1, Math.round(numberValue(sourceAttempt, "attempt_number"))),
        responseTimeMs: Math.max(0, Math.min(3_600_000, Math.round(numberValue(sourceAttempt, "response_time_ms")))),
        submittedJson: {
          kind: "SYNTHETIC_FIXTURE",
          sourceAttemptId: sourceAttempt.attempt_id,
          directIdentifier: false
        },
        score: isCorrect ? 1 : 0,
        metadataJson: metadata({ linkedDemoEvidence: true, gradingMode: "SYNTHETIC_DATASET_LABEL" }),
        createdAt: interactionAt
      },
      update: {
        eventId: event.id,
        userId: profile.userId,
        exerciseId: exercise.id,
        isCorrect,
        usedHint: sourceAttempt.used_hint === "1",
        skipped: sourceAttempt.skipped === "1",
        attemptNumber: Math.max(1, Math.round(numberValue(sourceAttempt, "attempt_number"))),
        responseTimeMs: Math.max(0, Math.min(3_600_000, Math.round(numberValue(sourceAttempt, "response_time_ms")))),
        submittedJson: {
          kind: "SYNTHETIC_FIXTURE",
          sourceAttemptId: sourceAttempt.attempt_id,
          directIdentifier: false
        },
        score: isCorrect ? 1 : 0,
        metadataJson: metadata({ linkedDemoEvidence: true, gradingMode: "SYNTHETIC_DATASET_LABEL" }),
        createdAt: interactionAt
      }
    });
    const misconception = sourceAttempt.misconception_code
      ? misconceptionByCode.get(sourceAttempt.misconception_code)
      : undefined;
    if (misconception) {
      const diagnosisId = stableUuid(`linked-diagnosis:${studentRow.student_id}`);
      await prisma.attemptDiagnosis.upsert({
        where: { id: diagnosisId },
        create: {
          id: diagnosisId,
          attemptId: attempt.id,
          misconceptionId: misconception.id,
          status: "SYNTHETIC_LABEL",
          confidence: 0.55,
          source: "SYNTHETIC_DATASET",
          ruleCode: null,
          evidenceJson: { sourceAttemptId: sourceAttempt.attempt_id, educationalImpactEvidence: false },
          modelVersion: "synthetic-linked-evidence-v1",
          createdAt: interactionAt
        },
        update: {
          attemptId: attempt.id,
          misconceptionId: misconception.id,
          status: "SYNTHETIC_LABEL",
          confidence: 0.55,
          source: "SYNTHETIC_DATASET",
          ruleCode: null,
          evidenceJson: { sourceAttemptId: sourceAttempt.attempt_id, educationalImpactEvidence: false },
          modelVersion: "synthetic-linked-evidence-v1",
          createdAt: interactionAt
        }
      });
    }
    const recommendationId = stableUuid(`linked-recommendation:${studentRow.student_id}`);
    const existingRecommendation = await prisma.recommendation.findUnique({ where: { id: recommendationId } });
    assertSeedable(existingRecommendation, `Recommendation ${studentRow.student_id}`);
    const recommendation = await prisma.recommendation.upsert({
      where: { id: recommendationId },
      create: {
        id: recommendationId,
        studentProfileId: profile.id,
        conceptId: concept.id,
        action: RecommendationAction.PRACTICE_SET,
        priorityScore: clamp(0.82 - index * 0.012, 0.45, 0.82),
        targetType: "EXERCISE",
        targetId: exercise.id,
        targetPhase: exercise.phase,
        estimatedMinutes: 8,
        reasonsJson: ["Bằng chứng tổng hợp cho thấy kỹ năng này cần luyện thêm", "Đích học đã được phân giải tới bài tập ACTIVE"],
        candidateLogJson: { selectedExerciseCode: exercise.code, syntheticFixture: true },
        status: RecommendationStatus.ACTIVE,
        modelVersion: "synthetic-linked-evidence-v1",
        metadataJson: metadata({
          linkedDemoEvidence: true,
          educationalImpactEvidence: false,
          targetResolution: { resolved: true, type: "EXERCISE", id: exercise.id }
        }),
        createdAt: interactionAt
      },
      update: {
        studentProfileId: profile.id,
        conceptId: concept.id,
        action: RecommendationAction.PRACTICE_SET,
        priorityScore: clamp(0.82 - index * 0.012, 0.45, 0.82),
        targetType: "EXERCISE",
        targetId: exercise.id,
        targetPhase: exercise.phase,
        estimatedMinutes: 8,
        reasonsJson: ["Bằng chứng tổng hợp cho thấy kỹ năng này cần luyện thêm", "Đích học đã được phân giải tới bài tập ACTIVE"],
        candidateLogJson: { selectedExerciseCode: exercise.code, syntheticFixture: true },
        status: RecommendationStatus.ACTIVE,
        modelVersion: "synthetic-linked-evidence-v1",
        metadataJson: metadata({
          linkedDemoEvidence: true,
          educationalImpactEvidence: false,
          targetResolution: { resolved: true, type: "EXERCISE", id: exercise.id }
        }),
        createdAt: interactionAt
      }
    });
    const evidenceId = stableUuid(`linked-recommendation-evidence:${studentRow.student_id}`);
    await prisma.recommendationEvidence.upsert({
      where: { id: evidenceId },
      create: {
        id: evidenceId,
        recommendationId: recommendation.id,
        attemptId: attempt.id,
        type: "SYNTHETIC_ATTEMPT",
        valueJson: { isCorrect, sourceAttemptId: sourceAttempt.attempt_id },
        explanation: "Bản ghi tổng hợp dùng để trình diễn khả năng truy vết; không phải bằng chứng tác động giáo dục.",
        createdAt: interactionAt
      },
      update: {
        recommendationId: recommendation.id,
        attemptId: attempt.id,
        type: "SYNTHETIC_ATTEMPT",
        valueJson: { isCorrect, sourceAttemptId: sourceAttempt.attempt_id },
        explanation: "Bản ghi tổng hợp dùng để trình diễn khả năng truy vết; không phải bằng chứng tác động giáo dục.",
        createdAt: interactionAt
      }
    });
    const reviewId = stableUuid(`linked-review-schedule:${studentRow.student_id}`);
    const dueAt = new Date(Date.now() + ((index % 3) - 1) * 86_400_000);
    await prisma.reviewSchedule.upsert({
      where: { id: reviewId },
      create: {
        id: reviewId,
        studentProfileId: profile.id,
        conceptId: concept.id,
        recommendationId: recommendation.id,
        dueAt,
        intervalDays: 1 + (index % 3) * 2,
        retrievabilityAtSchedule: clamp(0.48 + (index % 5) * 0.07),
        status: dueAt <= new Date() ? ReviewScheduleStatus.DUE : ReviewScheduleStatus.SCHEDULED,
        metadataJson: metadata({ linkedDemoEvidence: true, reason: "Lịch ôn từ bằng chứng tổng hợp" }),
        createdAt: interactionAt
      },
      update: {
        studentProfileId: profile.id,
        conceptId: concept.id,
        recommendationId: recommendation.id,
        dueAt,
        intervalDays: 1 + (index % 3) * 2,
        retrievabilityAtSchedule: clamp(0.48 + (index % 5) * 0.07),
        status: dueAt <= new Date() ? ReviewScheduleStatus.DUE : ReviewScheduleStatus.SCHEDULED,
        metadataJson: metadata({ linkedDemoEvidence: true, reason: "Lịch ôn từ bằng chứng tổng hợp" }),
        createdAt: interactionAt
      }
    });
  }

  console.log(
    `Seeded ${FIXTURE}: 3 teachers, 20 students, 1 class, 12 lessons, 60 reviewed exercises, 160 states, 400 model-snapshot histories and 20 linked synthetic demo attempts.`
  );
}

seed()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message.replace(/postgresql:\/\/\S+/g, "[redacted-url]"));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
