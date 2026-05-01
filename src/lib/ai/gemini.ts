type GeminiLabData = {
  description?: string;
  website?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  images?: string[];
  source?: string;
};

export type GeminiFetchResult =
  | { ok: true; data: GeminiLabData }
  | {
      ok: false;
      reason: "MISSING_API_KEY" | "TIMEOUT" | "HTTP_ERROR" | "EMPTY_RESPONSE" | "INVALID_JSON" | "REQUEST_FAILED";
      status?: number;
    };

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
}

export async function fetchLabDataWithGemini(labName: string, city?: string | null, state?: string | null): Promise<GeminiFetchResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reason: "MISSING_API_KEY" };

  const prompt = [
    "Return ONLY valid JSON. No text before or after.",
    "Find public profile details for this medical diagnostic lab.",
    "JSON keys: description, website, phone, address, logoUrl, images, source",
    `labName: ${labName}`,
    `city: ${city ?? ""}`,
    `state: ${state ?? ""}`,
  ].join("\n");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const timeout = withTimeout(10_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
      signal: timeout.controller.signal,
      cache: "no-store",
    });

    if (!res.ok) return { ok: false, reason: "HTTP_ERROR", status: res.status };
    const payload = (await res.json()) as any;
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) return { ok: false, reason: "EMPTY_RESPONSE" };

    try {
      const parsed = JSON.parse(text) as GeminiLabData;
      if (!parsed || typeof parsed !== "object") {
        return { ok: false, reason: "INVALID_JSON" };
      }
      return { ok: true, data: parsed };
    } catch {
      return { ok: false, reason: "INVALID_JSON" };
    }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return { ok: false, reason: "TIMEOUT" };
    }
    return { ok: false, reason: "REQUEST_FAILED" };
  } finally {
    timeout.clear();
  }
}
