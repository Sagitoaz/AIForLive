import type { AssessmentQuestion, PracticeActivity } from "../../common/types";
import type { GenerateContentDto } from "../dto/generate-content.dto";
import type { ProviderOutput } from "./content-provider";

/** FEATURE-016: the level string decides how deep theory/practice/assessment go. */
export function isAdvancedLevel(level: string): boolean {
  const normalised = level.toLowerCase();
  return normalised.includes("lớp 11") || normalised.includes("nâng cao") || normalised.includes("có nền tảng");
}

type Quiz = ProviderOutput["quiz"];

export function buildTheoryMaterial(input: GenerateContentDto, isRange: boolean, advanced: boolean): ProviderOutput["theory"] {
  return {
    videos: [
      {
        title: isRange ? "Video: range() dừng ở đâu?" : `Video: giới thiệu ${input.conceptCode}`,
        description: advanced
          ? "Phân tích semantics của tham số stop và step ở mức nâng cao."
          : "Giải thích trực quan bằng hình ảnh robot đi qua dãy số.",
        // Synthetic, provider-neutral placeholder — validated but never auto-played.
        url: "media://lectures/python-range-intro",
        durationSeconds: advanced ? 420 : 180,
        thumbnailUrl: "media://thumbnails/python-range"
      }
    ],
    documents: [
      {
        title: "Tài liệu đọc thêm: vòng lặp và range()",
        description: "Trích từ Python handbook nội bộ đã kiểm duyệt.",
        content: isRange
          ? "range(start, stop, step) tạo dãy bắt đầu ở start, tăng theo step và dừng trước stop."
          : `Ghi chú nền tảng cho ${input.conceptCode}: đọc kỹ ví dụ trước khi luyện tập.`
      }
    ],
    summary: isRange
      ? "Bắt đầu ở start, tăng theo step, dừng trước stop. Muốn lấy tới n thì stop = n + 1."
      : `Tóm tắt: nắm quy tắc cốt lõi của ${input.conceptCode}, xem ví dụ và tự kiểm tra bằng một câu hỏi nhanh.`
  };
}

export function buildPracticeMaterial(
  input: GenerateContentDto,
  isRange: boolean,
  advanced: boolean,
  quiz: Quiz
): PracticeActivity[] {
  const concept = input.conceptCode;
  return [
    {
      id: "practice-code-example",
      type: "CODE_EXAMPLE",
      title: "Ví dụ minh họa",
      instructions: "Đọc đoạn code mẫu và chú thích từng bước.",
      conceptCode: concept,
      difficulty: advanced ? 0.5 : 0.25,
      maxScore: 0,
      starterCode: isRange ? "for n in range(1, 5):\n    print(n)" : `# Ví dụ cho ${concept}`,
      expectedOutput: isRange ? "1\n2\n3\n4" : undefined,
      hints: ["Đọc tham số của range trước khi dự đoán."],
      explanation: isRange ? "range(1, 5) đi qua 1, 2, 3, 4 rồi dừng trước 5." : "Quan sát trạng thái thay đổi qua từng bước.",
      order: 1
    },
    {
      id: "practice-output-prediction",
      type: "OUTPUT_PREDICTION",
      title: "Đoán output",
      instructions: "Đoán kết quả của đoạn code trước khi chạy.",
      conceptCode: concept,
      difficulty: advanced ? 0.6 : 0.35,
      maxScore: 10,
      prompt: isRange ? "list(range(5)) in ra gì?" : `Đoạn code ${concept} sẽ in ra gì?`,
      expectedOutput: isRange ? "[0, 1, 2, 3, 4]" : "…",
      hints: ["range(5) tương đương range(0, 5)."],
      solution: isRange ? "[0, 1, 2, 3, 4]" : "Xem lời giải mẫu.",
      explanation: isRange ? "range(5) bắt đầu ở 0 và dừng trước 5." : "So sánh dự đoán với kết quả thực tế.",
      order: 2
    },
    {
      id: "practice-debug",
      type: "DEBUGGING_EXERCISE",
      title: "Sửa lỗi code",
      instructions: "Tìm và sửa lỗi khiến dãy bị sai.",
      conceptCode: concept,
      difficulty: advanced ? 0.7 : 0.45,
      maxScore: 10,
      starterCode: isRange ? "# In 1..5\nfor n in range(1, 5):\n    print(n)" : "# Sửa lỗi bên dưới",
      expectedOutput: isRange ? "1\n2\n3\n4\n5" : undefined,
      hints: ["Muốn in tới 5 thì stop phải là 6."],
      solution: isRange ? "for n in range(1, 6):\n    print(n)" : "Xem lời giải mẫu.",
      explanation: isRange ? "stop là loại trừ, nên cần range(1, 6)." : "Xác định dòng gây lỗi rồi sửa.",
      order: 3
    },
    {
      id: "practice-quiz",
      type: "MULTIPLE_CHOICE",
      title: "Trắc nghiệm nhanh",
      instructions: quiz.question,
      conceptCode: concept,
      difficulty: advanced ? 0.55 : 0.3,
      maxScore: 10,
      options: quiz.options,
      correctIndex: quiz.correctIndex,
      hints: ["Đọc kỹ điểm dừng của dãy."],
      explanation: quiz.explanation,
      order: 4
    }
  ];
}

export function buildFinalAssessmentMaterial(
  input: GenerateContentDto,
  isRange: boolean,
  advanced: boolean
): ProviderOutput["finalAssessment"] {
  const concept = input.conceptCode;
  const questions: AssessmentQuestion[] = [
    {
      id: "final-q1",
      type: "MULTIPLE_CHOICE",
      conceptCode: concept,
      prompt: isRange ? "list(range(3)) trả về gì?" : `Khẳng định nào đúng về ${concept}?`,
      options: isRange ? ["[0, 1, 2]", "[1, 2, 3]", "[0, 1, 2, 3]"] : ["Đúng", "Sai", "Không xác định"],
      correctIndex: 0,
      points: 20,
      explanation: isRange ? "range(3) là range(0, 3) → 0, 1, 2." : "Dựa trên quy tắc đã học."
    },
    {
      id: "final-q2",
      type: "OUTPUT_PREDICTION",
      conceptCode: concept,
      prompt: isRange ? "for i in range(2, 5): print(i) — in ra gì?" : "Đoạn code mẫu in ra gì?",
      expectedAnswer: isRange ? "2 3 4" : "…",
      points: 20,
      explanation: isRange ? "range(2, 5) đi qua 2, 3, 4." : "So sánh với ví dụ."
    },
    {
      id: "final-q3",
      type: "DEBUGGING",
      conceptCode: concept,
      prompt: isRange ? "Sửa range(1, 5) để in tới 5. Điểm dừng đúng là?" : "Dòng nào cần sửa?",
      options: isRange ? ["range(1, 6)", "range(1, 5)", "range(0, 5)"] : ["Dòng 1", "Dòng 2", "Không có"],
      correctIndex: 0,
      points: 20,
      explanation: isRange ? "stop loại trừ nên dùng range(1, 6)." : "Xác định lỗi logic."
    },
    {
      id: "final-q4",
      type: "SCENARIO",
      conceptCode: concept,
      prompt: isRange
        ? "Bạn cần in số ghế từ 1 đến 30. Viết biểu thức range phù hợp."
        : `Áp dụng ${concept} vào một tình huống thực tế.`,
      expectedAnswer: isRange ? "range(1, 31)" : "…",
      points: 20,
      explanation: isRange ? "Muốn tới 30 thì stop = 31." : "Áp dụng đúng quy tắc."
    },
    {
      id: "final-q5",
      type: "SHORT_CODE",
      conceptCode: concept,
      prompt: isRange ? "Viết vòng lặp in các số chẵn từ 2 đến 10." : "Viết đoạn code ngắn áp dụng khái niệm.",
      expectedAnswer: isRange ? "for i in range(2, 11, 2): print(i)" : "…",
      points: 20,
      explanation: isRange ? "Dùng step = 2 và stop = 11." : "Kiểm tra khả năng viết code ngắn."
    }
  ];
  if (advanced) {
    questions.push({
      id: "final-q6",
      type: "SCENARIO",
      conceptCode: concept,
      prompt: isRange
        ? "Vì sao range(10, 0, -1) đếm ngược nhưng không bao gồm 0? Giải thích ngắn gọn."
        : "Phân tích một trường hợp biên của khái niệm.",
      expectedAnswer: isRange ? "stop = 0 bị loại trừ nên dãy dừng ở 1" : "…",
      points: 20,
      explanation: isRange ? "Với step âm, dãy dừng ngay trước stop = 0." : "Lập luận dựa trên quy tắc."
    });
  }
  return { passingScore: 0.7, questions, skillCoverage: [concept] };
}
