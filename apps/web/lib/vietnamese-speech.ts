import { apiAudioRequest } from "@/lib/api";

export type VietnameseSpeechFailure =
  | "unsupported"
  | "empty-text"
  | "missing-vietnamese-voice"
  | "server-unavailable"
  | "synthesis-error";

export type VietnameseSpeechResult =
  | { ok: true; provider: "FPT.AI-VITs" | "BROWSER"; voiceName: string }
  | { ok: false; reason: VietnameseSpeechFailure };

const VIETNAMESE_VOICE_NAME = /vietnam|tiếng việt|hoài my|hoaimy|nam minh|namminh/i;
let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;

function normalizedLanguage(language: string): string {
  return language.trim().replaceAll("_", "-").toLowerCase();
}

export function vietnameseVoiceScore(voice: Pick<SpeechSynthesisVoice, "default" | "lang" | "localService" | "name">): number {
  const language = normalizedLanguage(voice.lang);
  const nameMatches = VIETNAMESE_VOICE_NAME.test(voice.name);
  if (!language.startsWith("vi") && !nameMatches) return -1;

  let score = 0;
  if (language === "vi-vn") score += 100;
  else if (language === "vi" || language.startsWith("vi-")) score += 80;
  if (nameMatches) score += 20;
  if (/natural|online|google/i.test(voice.name)) score += 5;
  if (voice.localService) score += 2;
  if (voice.default) score += 1;
  return score;
}

export function selectVietnameseVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return [...voices]
    .map((voice) => ({ voice, score: vietnameseVoiceScore(voice) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score)[0]?.voice ?? null;
}

async function loadVoices(synthesis: SpeechSynthesis, timeoutMs = 1_500): Promise<SpeechSynthesisVoice[]> {
  const immediate = synthesis.getVoices();
  if (selectVietnameseVoice(immediate)) return immediate;

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      synthesis.removeEventListener("voiceschanged", handleVoicesChanged);
      resolve(synthesis.getVoices());
    };
    const handleVoicesChanged = () => finish();
    const timer = window.setTimeout(finish, timeoutMs);
    synthesis.addEventListener("voiceschanged", handleVoicesChanged);
  });
}

export function stopVietnameseSpeech(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load();
    activeAudio = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

async function speakWithFpt(text: string): Promise<VietnameseSpeechResult> {
  const audioBlob = await apiAudioRequest("/tts/speech", { text });
  stopVietnameseSpeech();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  activeAudio = audio;
  activeAudioUrl = audioUrl;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      if (activeAudio === audio) activeAudio = null;
      if (activeAudioUrl === audioUrl) activeAudioUrl = null;
      URL.revokeObjectURL(audioUrl);
    };
    audio.onended = () => {
      cleanup();
      resolve({ ok: true, provider: "FPT.AI-VITs", voiceName: "std_kimngan" });
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("The browser could not play the FPT audio response"));
    };
    void audio.play().catch((error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error("Audio playback failed"));
    });
  });
}

async function speakWithBrowser(text: string): Promise<VietnameseSpeechResult> {
  if (
    typeof window === "undefined"
    || !("speechSynthesis" in window)
    || typeof window.SpeechSynthesisUtterance !== "function"
  ) {
    return { ok: false, reason: "unsupported" };
  }

  const narration = text.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!narration) return { ok: false, reason: "empty-text" };

  const synthesis = window.speechSynthesis;
  const voice = selectVietnameseVoice(await loadVoices(synthesis));
  if (!voice) return { ok: false, reason: "missing-vietnamese-voice" };

  synthesis.cancel();
  synthesis.resume();

  const utterance = new window.SpeechSynthesisUtterance(narration);
  utterance.voice = voice;
  utterance.lang = normalizedLanguage(voice.lang).startsWith("vi") ? voice.lang : "vi-VN";
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      synthesis.cancel();
      resolve({ ok: false, reason: "synthesis-error" });
    }, 90_000);
    utterance.onend = () => {
      clearTimeout(timeout);
      resolve({ ok: true, provider: "BROWSER", voiceName: voice.name });
    };
    utterance.onerror = () => {
      clearTimeout(timeout);
      resolve({ ok: false, reason: "synthesis-error" });
    };
    synthesis.speak(utterance);
  });
}

export async function speakVietnamese(text: string): Promise<VietnameseSpeechResult> {
  const narration = text.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!narration) return { ok: false, reason: "empty-text" };
  try {
    return await speakWithFpt(narration);
  } catch {
    const fallback = await speakWithBrowser(narration);
    return fallback.ok ? fallback : { ok: false, reason: "server-unavailable" };
  }
}

export function vietnameseSpeechMessage(result: VietnameseSpeechResult): string {
  if (result.ok && result.provider === "FPT.AI-VITs") return `Đã đọc bằng FPT.AI-VITs · ${result.voiceName}`;
  if (result.ok) return `FPT TTS tạm lỗi; đã dùng voice Việt dự phòng: ${result.voiceName}`;
  if (result.reason === "server-unavailable") {
    return "FPT.AI-VITs hiện không khả dụng và máy không có voice Việt dự phòng.";
  }
  if (result.reason === "missing-vietnamese-voice") {
    return "Trình duyệt chưa có giọng tiếng Việt. Hãy bật hoặc cài voice tiếng Việt rồi tải lại trang.";
  }
  if (result.reason === "empty-text") return "Slide này chưa có lời đọc.";
  if (result.reason === "unsupported") return "Trình duyệt này chưa hỗ trợ đọc văn bản.";
  return "Không thể phát giọng đọc. Hãy thử lại hoặc đổi trình duyệt.";
}
