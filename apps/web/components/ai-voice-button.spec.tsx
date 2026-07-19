import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiVoiceButton } from "./ai-voice-button";
import { speakVietnamese } from "@/lib/vietnamese-speech";

vi.mock("@/lib/vietnamese-speech", () => ({
  speakVietnamese: vi.fn(),
  vietnameseSpeechMessage: (result: { ok: boolean; provider?: string }) => result.ok && result.provider === "FPT.AI-VITs"
    ? "Đã đọc bằng FPT.AI-VITs · std_kimngan"
    : "Đã dùng voice dự phòng"
}));

const speakMock = vi.mocked(speakVietnamese);

describe("AI Voice button", () => {
  beforeEach(() => speakMock.mockReset());

  it("sends the approved narration to TTS and exposes the provider result", async () => {
    speakMock.mockResolvedValue({ ok: true, provider: "FPT.AI-VITs", voiceName: "std_kimngan" });
    render(<AiVoiceButton text="  Dãy số dừng trước năm.  " />);

    fireEvent.click(screen.getByRole("button", { name: "Phát nội dung bài học bằng AI Voice" }));

    expect(speakMock).toHaveBeenCalledWith("Dãy số dừng trước năm.");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("FPT.AI-VITs"));
    expect(screen.getByRole("button")).toHaveTextContent("AI Voice · Nghe bài");
  });

  it("disables playback when no narration is available", () => {
    render(<AiVoiceButton text="   " />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
