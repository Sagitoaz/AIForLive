"use client";

import { useState } from "react";
import { speakVietnamese, vietnameseSpeechMessage } from "@/lib/vietnamese-speech";

interface AiVoiceButtonProps {
  text: string;
  className?: string;
}

export function AiVoiceButton({ text, className = "button ghost small" }: AiVoiceButtonProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const narration = text.normalize("NFC").replace(/\s+/g, " ").trim();

  const play = async () => {
    if (!narration || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await speakVietnamese(narration);
      setMessage(vietnameseSpeechMessage(result));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="ai-voice-control">
      <button
        type="button"
        className={className}
        disabled={!narration || busy}
        aria-label="Phát nội dung bài học bằng AI Voice"
        onClick={() => void play()}
      >
        {busy ? "AI Voice · Đang đọc…" : "AI Voice · Nghe bài"}
      </button>
      {message && <small className="ai-voice-status" role="status">{message}</small>}
    </span>
  );
}
