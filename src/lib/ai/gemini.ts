type GeminiLabData = {
  description?: string;
  website?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  images?: string[];
  source?: string;
};

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
}

export async function fetchLabDataWithGemini(labName: string, city?: string | null, state?: string | null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

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

    if (!res.ok) return null;
    const payload = (await res.json()) as any;
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) return null;

    try {
      const parsed = JSON.parse(text) as GeminiLabData;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    timeout.clear();
  }
}
