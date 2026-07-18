import { GenerateContentDto } from "../dto/generate-content.dto";
import { ExternalLlmProvider } from "./external-llm.provider";

const originalEnv = { ...process.env };

function input(): GenerateContentDto {
  return Object.assign(new GenerateContentDto(), {
    domainCode: "python-foundations",
    conceptCode: "PYTHON_RANGE",
    misconceptionCode: "RANGE_STOP_INCLUDED",
    level: "Mới bắt đầu",
    learningObjective: "Biết rằng stop không thuộc dãy",
    durationMinutes: 5,
    sourceId: "source-python-handbook-01",
    provider: "EXTERNAL_LLM"
  });
}

function generatedLesson(): string {
  return JSON.stringify({
    title: "Dừng trước stop với range()",
    objectives: ["Giải thích được vì sao stop không thuộc dãy"],
    slides: [
      {
        id: "slide-1",
        order: 1,
        type: "CONCEPT",
        title: "Điểm dừng của range",
        body: "range bắt đầu tại start và luôn dừng ngay trước giá trị stop.",
        narration: "Hãy nhớ rằng số stop là vạch dừng và không thuộc dãy.",
        animationTemplate: "NUMBER_SEQUENCE",
        animationData: { start: 1, stop: 5, values: ["1", "2", "3", "4"] }
      },
      {
        id: "slide-2",
        order: 2,
        type: "EXAMPLE",
        title: "Ví dụ bốn bước",
        body: "range(1, 5) tạo ra bốn số là 1, 2, 3 và 4.",
        code: "list(range(1, 5))",
        narration: "Ví dụ này có bốn số và không có số năm.",
        animationTemplate: "LOOP_TIMELINE",
        animationData: { iterations: 4, values: ["1", "2", "3", "4"] }
      },
      {
        id: "slide-3",
        order: 3,
        type: "MISCONCEPTION",
        code: "",
        title: "Không lấy số stop",
        body: "Đưa số 5 vào kết quả là hiểu nhầm vì vòng lặp đã dừng trước đó.",
        narration: "Nếu muốn có số năm, em cần đặt stop là số sáu.",
        animationTemplate: "BUG_REVEAL",
        animationData: { wrongLine: "1,2,3,4,5", fixedLine: "1,2,3,4", message: "Dừng trước stop" }
      }
    ],
    quiz: {
      question: "list(range(2, 5)) có kết quả nào?",
      options: ["[2, 3, 4]", "[2, 3, 4, 5]"],
      correctIndex: 0,
      explanation: "Dãy bắt đầu ở 2 và dừng trước 5."
    }
  });
}

describe("ExternalLlmProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("calls the configured FPT DeepSeek model and parses structured content", async () => {
    process.env.EXTERNAL_LLM_API_KEY = "test-key";
    process.env.EXTERNAL_LLM_BASE_URL = "https://mkp-api.fptcloud.com/";
    process.env.EXTERNAL_LLM_MODEL = "DeepSeek-V4-Flash";
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: generatedLesson() } }],
        usage: { prompt_tokens: 100, completion_tokens: 200 }
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const output = await new ExternalLlmProvider().generate(input());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://mkp-api.fptcloud.com/chat/completions");
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body.model).toBe("DeepSeek-V4-Flash");
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(output.provider).toBe("EXTERNAL_LLM");
    expect(output.trace).toMatchObject({
      model: "DeepSeek-V4-Flash",
      promptTokens: 100,
      completionTokens: 200
    });
    expect(output.trace?.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(output.sourceReferences).toEqual(["source-python-handbook-01"]);
    expect(output.slides).toHaveLength(3);
    expect(output.slides.map((slide) => [slide.id, slide.order])).toEqual([
      ["slide-1", 1],
      ["slide-2", 2],
      ["slide-3", 3]
    ]);
    expect(output.slides[2]?.code).toBeUndefined();
  });

  it("returns a safe service error when FPT rejects the request", async () => {
    process.env.EXTERNAL_LLM_API_KEY = "test-key";
    jest.spyOn(global, "fetch").mockResolvedValue(new Response("denied", { status: 401 }));

    await expect(new ExternalLlmProvider().generate(input())).rejects.toThrow("FPT AI returned HTTP 401");
  });
});
