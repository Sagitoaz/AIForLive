import { afterEach, describe, expect, it, vi } from "vitest";
import { apiAudioRequest, apiRequest } from "./api";

describe("API session transport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("uses one refresh token exchange and retries an expired authenticated request", async () => {
    window.localStorage.setItem("edurecall-access-token", "expired-access");
    window.localStorage.setItem("edurecall-refresh-token", "valid-refresh");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        accessToken: "new-access",
        refreshToken: "new-refresh"
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      }));

    await expect(apiRequest<{ status: string }>("/session-refresh-test")).resolves.toEqual({ status: "ok" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ authorization: "Bearer expired-access" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/backend-api/auth/refresh");
    expect(fetchMock.mock.calls[2]?.[1]?.headers).toMatchObject({ authorization: "Bearer new-access" });
    expect(window.localStorage.getItem("edurecall-refresh-token")).toBe("new-refresh");
  });

  it("sends the access token with TTS so the public endpoint cannot consume provider quota", async () => {
    window.localStorage.setItem("edurecall-access-token", "student-access");
    const wav = new Uint8Array(64);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(wav, {
      status: 200,
      headers: { "content-type": "audio/wav" }
    }));

    await apiAudioRequest("/tts/speech", { text: "Xin chào" });

    expect(fetchMock).toHaveBeenCalledWith("/backend-api/tts/speech", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer student-access" })
    }));
  });
});
