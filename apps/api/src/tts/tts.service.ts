import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";

interface SpeechClip {
  audio: Buffer;
  contentType: string;
  cacheHit: boolean;
}

const MAX_CACHE_ENTRIES = 64;

@Injectable()
export class TtsService {
  private readonly cache = new Map<string, { audio: Buffer; contentType: string }>();

  async synthesize(rawText: string): Promise<SpeechClip> {
    const text = rawText.normalize("NFC").replace(/\s+/g, " ").trim();
    const baseUrl = (process.env.TTS_BASE_URL ?? process.env.EXTERNAL_LLM_BASE_URL ?? "https://mkp-api.fptcloud.com").replace(/\/+$/, "");
    const model = process.env.TTS_MODEL ?? "FPT.AI-VITs";
    const voice = process.env.TTS_VOICE ?? "std_kimngan";
    const responseFormat = process.env.TTS_RESPONSE_FORMAT ?? "wav";
    const key = createHash("sha256").update(`${model}\u0000${voice}\u0000${responseFormat}\u0000${text}`).digest("hex");
    const cached = this.cache.get(key);
    if (cached) return { ...cached, cacheHit: true };

    // EXTERNAL_TTS_API_KEY is retained as a compatibility alias for the
    // original Render environment. New deployments should use TTS_API_KEY.
    const apiKey = process.env.TTS_API_KEY
      ?? process.env.EXTERNAL_TTS_API_KEY
      ?? process.env.EXTERNAL_LLM_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException("FPT Marketplace API key is not configured for TTS");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.TTS_TIMEOUT_MS ?? 90_000));
    try {
      const response = await fetch(`${baseUrl}/v1/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model, input: text, response_format: responseFormat, voice }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`FPT TTS returned HTTP ${response.status}`);

      const contentType = response.headers.get("content-type")?.split(";")[0] ?? `audio/${responseFormat}`;
      const audio = Buffer.from(await response.arrayBuffer());
      if (!contentType.startsWith("audio/") || audio.length < 44) {
        throw new Error("FPT TTS returned an invalid audio response");
      }

      if (this.cache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = this.cache.keys().next().value as string | undefined;
        if (oldestKey) this.cache.delete(oldestKey);
      }
      this.cache.set(key, { audio, contentType });
      return { audio, contentType, cacheHit: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      throw new ServiceUnavailableException(`Vietnamese TTS is unavailable: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
