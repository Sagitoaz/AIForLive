import { describe, expect, it } from "vitest";
import { selectVietnameseVoice, vietnameseVoiceScore } from "./vietnamese-speech";

function voice(name: string, lang: string, options: { default?: boolean; localService?: boolean } = {}): SpeechSynthesisVoice {
  return {
    default: options.default ?? false,
    lang,
    localService: options.localService ?? false,
    name,
    voiceURI: name
  };
}

describe("Vietnamese speech voice selection", () => {
  it("rejects a default English voice", () => {
    expect(vietnameseVoiceScore(voice("Microsoft Zira", "en-US", { default: true }))).toBe(-1);
  });

  it("prefers an exact Vietnamese natural voice", () => {
    const selected = selectVietnameseVoice([
      voice("Microsoft Zira", "en-US", { default: true }),
      voice("Vietnamese generic", "vi"),
      voice("Microsoft HoaiMy Online (Natural)", "vi-VN")
    ]);

    expect(selected?.name).toBe("Microsoft HoaiMy Online (Natural)");
  });

  it("recognizes Vietnamese voice names when a browser omits the language tag", () => {
    expect(selectVietnameseVoice([voice("Google Tiếng Việt", "")])?.name).toBe("Google Tiếng Việt");
  });
});
