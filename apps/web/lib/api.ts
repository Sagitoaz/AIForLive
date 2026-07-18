export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("edurecall-access-token");
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3_500);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...authHeaders(), ...init?.headers },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function apiFormRequest<T>(path: string, form: FormData): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${API_URL}${path}`, { method: "POST", body: form, headers: authHeaders(), signal: controller.signal });
    if (!response.ok) throw new Error(`Upload API ${response.status}`);
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function apiAudioRequest(path: string, body: Record<string, unknown>): Promise<Blob> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Audio API ${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith("audio/") || blob.size < 44) throw new Error("Audio API returned invalid data");
    return blob;
  } finally {
    window.clearTimeout(timeout);
  }
}
