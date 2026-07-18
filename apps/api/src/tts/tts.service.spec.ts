import { TtsService } from "./tts.service";

const originalEnv = { ...process.env };

describe("TtsService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("calls FPT.AI-VITs and caches the WAV response", async () => {
    process.env.EXTERNAL_LLM_API_KEY = "test-key";
    process.env.TTS_BASE_URL = "https://mkp-api.fptcloud.com/";
    const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(100)]);
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(new Uint8Array(wav), { status: 200, headers: { "Content-Type": "audio/wav" } })
    );
    const service = new TtsService();

    const first = await service.synthesize("Xin chào học sinh.");
    const second = await service.synthesize("Xin chào học sinh.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://mkp-api.fptcloud.com/v1/audio/speech");
    expect(request?.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.parse(String(request?.body))).toEqual({
      model: "FPT.AI-VITs",
      input: "Xin chào học sinh.",
      response_format: "wav",
      voice: "std_kimngan"
    });
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.audio.subarray(0, 4).toString("ascii")).toBe("RIFF");
  });

  it("does not expose an upstream response body when FPT rejects a request", async () => {
    process.env.EXTERNAL_LLM_API_KEY = "test-key";
    jest.spyOn(global, "fetch").mockResolvedValue(new Response("sensitive upstream detail", { status: 400 }));

    await expect(new TtsService().synthesize("Một câu tiếng Việt.")).rejects.toThrow(
      "Vietnamese TTS is unavailable: FPT TTS returned HTTP 400"
    );
  });
});
