// Keep browser traffic same-origin in both local development and the Render
// checkpoint deployment. Next.js proxies this prefix to the Nest API, which
// means no production URL is baked into the client bundle and CORS/CSP cannot
// drift when the Render hostname changes.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/backend-api";
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const inFlightGets = new Map<string, Promise<unknown>>();
const GET_CACHE_MS = 12_000;
let refreshInFlight: Promise<string | null> | null = null;

interface RefreshSession {
  accessToken: string;
  refreshToken: string;
}

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("edurecall-access-token");
  return token ? { authorization: `Bearer ${token}` } : {};
}

function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("edurecall-access-token");
  window.localStorage.removeItem("edurecall-refresh-token");
}

async function performRefresh(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = window.localStorage.getItem("edurecall-refresh-token");
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    if (!response.ok) throw new Error(`Refresh API ${response.status}`);
    const session = await response.json() as Partial<RefreshSession>;
    if (typeof session.accessToken !== "string" || typeof session.refreshToken !== "string") {
      throw new Error("Refresh API returned an invalid session");
    }
    window.localStorage.setItem("edurecall-access-token", session.accessToken);
    window.localStorage.setItem("edurecall-refresh-token", session.refreshToken);
    responseCache.clear();
    return session.accessToken;
  } catch {
    clearStoredSession();
    return null;
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function fetchWithSession(path: string, init?: RequestInit): Promise<Response> {
  const send = () => fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers }
  });
  let response = await send();
  if (response.status !== 401 || path.startsWith("/auth/")) return response;
  const refreshed = await refreshAccessToken();
  if (refreshed) response = await send();
  return response;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const token = typeof window === "undefined" ? "server" : window.localStorage.getItem("edurecall-access-token") ?? "anonymous";
  const cacheKey = `${token}:${path}`;
  if (method === "GET") {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    const pending = inFlightGets.get(cacheKey);
    if (pending) return pending as Promise<T>;
  } else {
    responseCache.clear();
  }

  const request = requestJson<T>(path, init).then((value) => {
    if (method === "GET") responseCache.set(cacheKey, { expiresAt: Date.now() + GET_CACHE_MS, value });
    return value;
  }).finally(() => { if (method === "GET") inFlightGets.delete(cacheKey); });
  if (method === "GET") inFlightGets.set(cacheKey, request);
  return request;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = path.startsWith("/ai/content/generate") || path.startsWith("/teacher/course-plans") ? 75_000 : 25_000;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchWithSession(path, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
      signal: controller.signal
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
      const message = Array.isArray(payload?.message) ? payload.message.join(", ") : payload?.message;
      throw new Error(message ?? `API ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function apiFormRequest<T>(path: string, form: FormData): Promise<T> {
  responseCache.clear();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchWithSession(path, { method: "POST", body: form, signal: controller.signal });
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
    const response = await fetchWithSession(path, {
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
