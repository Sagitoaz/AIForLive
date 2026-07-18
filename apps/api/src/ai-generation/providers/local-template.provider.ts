import { Injectable } from "@nestjs/common";
import type { ContentSlide } from "../../common/types";
import type { ContentGenerationInput, ContentProvider, ProviderOutput } from "./content-provider";

@Injectable()
export class LocalTemplateProvider implements ContentProvider {
  readonly code = "LOCAL_TEMPLATE";

  async generate(input: ContentGenerationInput): Promise<ProviderOutput> {
    const start = performance.now();
    const isRange = input.misconceptionCode === "RANGE_STOP_INCLUDED";
    const title = isRange ? "Dừng đúng lúc với range()" : `Gỡ rối ${input.conceptCode}`;
    const slides: ContentSlide[] = isRange
      ? [
          {
            id: "slide-concept",
            order: 1,
            type: "CONCEPT",
            title: "Ba mốc của range",
            body: "range(start, stop) bắt đầu ở start và dừng ngay trước stop. Hãy coi stop như vạch đích: chạm vạch là dừng.",
            code: "range(1, 5)",
            narration: "Range có mốc bắt đầu và mốc dừng. Số ở mốc dừng không đi vào dãy.",
            animationTemplate: "NUMBER_SEQUENCE",
            animationData: { start: 1, stop: 5, step: 1, values: ["1", "2", "3", "4"] }
          },
          {
            id: "slide-example",
            order: 2,
            type: "EXAMPLE",
            title: "Robot Mầm bước bốn ô",
            body: "Với range(1, 5), Mầm ghé các ô 1, 2, 3, 4. Ô số 5 là biển STOP nên không được ghé.",
            code: "for n in range(1, 5):\n    print(n)",
            narration: "Mầm đi qua bốn ô. Khi thấy biển số năm, Mầm dừng lại.",
            animationTemplate: "LOOP_TIMELINE",
            animationData: { iterations: 4, values: ["1", "2", "3", "4"] }
          },
          {
            id: "slide-misconception",
            order: 3,
            type: "MISCONCEPTION",
            title: "Bẫy stop được lấy",
            body: "Nếu viết 1, 2, 3, 4, 5 thì bạn đã đưa stop vào dãy. Muốn nhận cả 5, điểm dừng phải là 6.",
            code: "list(range(1, 6))  # [1, 2, 3, 4, 5]",
            narration: "Muốn lấy số năm, hãy đặt điểm dừng sau nó, tức là số sáu.",
            animationTemplate: "BUG_REVEAL",
            animationData: { wrongLine: "range(1, 5) → ... 5", fixedLine: "range(1, 6) → ... 5", message: "stop is exclusive" }
          },
          {
            id: "slide-summary",
            order: 4,
            type: "SUMMARY",
            title: "Công thức nhớ nhanh",
            body: "Dãy bắt đầu tại start, tăng theo step và chỉ nhận giá trị nhỏ hơn stop khi step dương.",
            narration: "Hãy nhớ: bắt đầu ở start, nhưng dừng trước stop.",
            animationTemplate: "NUMBER_SEQUENCE",
            animationData: { start: 1, stop: 5, values: ["start ✓", "2", "3", "4", "stop ✕"] }
          }
        ]
      : [
          {
            id: "slide-concept",
            order: 1,
            type: "CONCEPT",
            title: "Ý tưởng cốt lõi",
            body: `Khái niệm ${input.conceptCode} được chia thành một quy tắc nhỏ, một ví dụ và một lần tự kiểm tra.`,
            narration: `Cùng Mầm khám phá ${input.conceptCode} theo từng bước.`,
            animationTemplate: "CODE_HIGHLIGHT",
            animationData: { lines: ["Đọc", "Dự đoán", "Kiểm tra"], activeLine: 1 }
          },
          {
            id: "slide-example",
            order: 2,
            type: "EXAMPLE",
            title: "Ví dụ nhỏ",
            body: "Đọc trạng thái trước, thực hiện đúng một bước rồi so sánh kết quả với dự đoán.",
            narration: "Mỗi lần chỉ thay đổi một điều để nhìn rõ nguyên nhân.",
            animationTemplate: "VARIABLE_CHANGE",
            animationData: { variable: "x", before: 1, after: 2 }
          },
          {
            id: "slide-misconception",
            order: 3,
            type: "MISCONCEPTION",
            title: "Kiểm tra hiểu nhầm",
            body: `Đừng kết luận ${input.misconceptionCode} nếu chưa có đủ evidence từ đáp án và lịch sử.`,
            narration: "Một lỗi đơn lẻ có thể là sơ suất, nên hệ thống cần bằng chứng.",
            animationTemplate: "BUG_REVEAL",
            animationData: { wrongLine: "Giả định", fixedLine: "Kiểm tra evidence", message: "Need evidence" }
          }
        ];
    return {
      title,
      objectives: [input.learningObjective, "Tự giải thích được vì sao đáp án sai", "Áp dụng đúng trong một ví dụ mới"],
      sourceReferences: [input.sourceId],
      slides,
      quiz: isRange
        ? {
            question: "list(range(2, 6)) cho kết quả nào?",
            options: ["[2, 3, 4, 5]", "[2, 3, 4, 5, 6]", "[1, 2, 3, 4, 5]"],
            correctIndex: 0,
            explanation: "Dãy bắt đầu ở 2 và dừng trước 6, nên phần tử cuối là 5."
          }
        : {
            question: "Bước nào giúp kiểm tra hiểu nhầm đáng tin cậy?",
            options: ["Dựa vào một lỗi", "Kết hợp đáp án và lịch sử", "Đoán ngẫu nhiên"],
            correctIndex: 1,
            explanation: "Cần nhiều evidence phù hợp trước khi kết luận misconception."
          },
      provider: "LOCAL_TEMPLATE",
      generationMs: Math.max(8, Math.round(performance.now() - start)),
      estimatedCostUsd: 0,
      sections: [
        {
          phase: "THEORY",
          title: "Lý thuyết có minh họa",
          durationMinutes: Math.max(2, Math.round(input.durationMinutes * 0.35)),
          summary: `Bài giảng, AI animation và phiếu đọc được grounding từ ${input.sourceId}.`,
          activityTypes: ["LECTURE", "ANIMATION", "DOCUMENT"]
        },
        {
          phase: "PRACTICE",
          title: "Thực hành có phản hồi",
          durationMinutes: Math.max(2, Math.round(input.durationMinutes * 0.45)),
          summary: "Học sinh dự đoán, chạy code rồi sửa một lỗi điển hình; mỗi lần nộp tạo learning event.",
          activityTypes: ["CODE", "MULTIPLE_CHOICE", "DEBUG"]
        },
        {
          phase: "CHECKPOINT",
          title: "Kiểm tra cuối bài",
          durationMinutes: Math.max(1, input.durationMinutes - Math.round(input.durationMinutes * 0.35) - Math.round(input.durationMinutes * 0.45)),
          summary: "Câu hỏi mới đo đúng kỹ năng mục tiêu và quyết định bước học tiếp theo.",
          activityTypes: ["MULTIPLE_CHOICE", "CODE"]
        }
      ]
    };
  }
}
