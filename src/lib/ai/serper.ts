type SerperLabData = {
  description?: string;
  website?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  images?: string[];
  source?: string;
};

export type SerperFetchResult =
  | { ok: true; data: SerperLabData }
  | {
      ok: false;
      reason: "MISSING_API_KEY" | "TIMEOUT" | "HTTP_ERROR" | "EMPTY_RESPONSE" | "REQUEST_FAILED";
      status?: number;
    };

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
}

function normalizeUrl(input?: string | null) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractFirstPhone(text?: string | null) {
  if (!text) return null;
  const m = text.match(/(\+?\d[\d\s\-().]{6,}\d)/);
  if (!m) return null;
  const phone = m[1].trim();
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? phone : null;
}

function scoreDomain(url: string, labName: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const normalized = labName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hostNorm = host.replace(/[^a-z0-9]/g, "");
    let score = 0;
    if (!host.includes("facebook.com") && !host.includes("instagram.com") && !host.includes("linkedin.com")) score += 2;
    if (hostNorm.includes(normalized.slice(0, Math.min(normalized.length, 8)))) score += 3;
    return score;
  } catch {
    return -1;
  }
}

export async function fetchLabDataWithSerper(labName: string, city?: string | null, state?: string | null): Promise<SerperFetchResult> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return { ok: false, reason: "MISSING_API_KEY" };

  const timeout = withTimeout(10_000);
  const query = [labName, city, state, "medical laboratory website phone address"].filter(Boolean).join(" ");

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: 8,
      }),
      signal: timeout.controller.signal,
      cache: "no-store",
    });

    if (!res.ok) return { ok: false, reason: "HTTP_ERROR", status: res.status };

    const payload = (await res.json()) as any;
    const organic = Array.isArray(payload?.organic) ? payload.organic : [];
    const knowledge = payload?.knowledgeGraph ?? null;
    if (!organic.length && !knowledge) return { ok: false, reason: "EMPTY_RESPONSE" };

    const candidates: string[] = [];
    for (const row of organic) {
      if (typeof row?.link === "string") candidates.push(row.link);
    }
    if (typeof knowledge?.website === "string") candidates.push(knowledge.website);

    let bestWebsite: string | null = null;
    let bestScore = -1;
    for (const link of candidates) {
      const normalized = normalizeUrl(link);
      if (!normalized) continue;
      const score = scoreDomain(normalized, labName);
      if (score > bestScore) {
        bestScore = score;
        bestWebsite = normalized;
      }
    }

    const snippets = organic
      .map((row: any) => (typeof row?.snippet === "string" ? row.snippet : ""))
      .filter(Boolean)
      .join(" ");

    const phone =
      extractFirstPhone(typeof knowledge?.phoneNumber === "string" ? knowledge.phoneNumber : null) ||
      extractFirstPhone(snippets) ||
      undefined;

    const address =
      (typeof knowledge?.address === "string" && knowledge.address.trim()) ||
      (city ? `${city}${state ? `, ${state}` : ""}` : undefined);

    const description =
      (typeof knowledge?.description === "string" && knowledge.description.trim()) ||
      (typeof organic[0]?.snippet === "string" ? organic[0].snippet.trim() : undefined);

    const images = Array.isArray(payload?.images)
      ? payload.images
          .map((img: any) => normalizeUrl(typeof img?.imageUrl === "string" ? img.imageUrl : null))
          .filter((v: string | null): v is string => Boolean(v))
      : [];

    const logoUrl = normalizeUrl(typeof knowledge?.imageUrl === "string" ? knowledge.imageUrl : null) || undefined;

    return {
      ok: true,
      data: {
        description,
        website: bestWebsite || undefined,
        phone,
        address,
        logoUrl,
        images,
        source: "serper-search-rules",
      },
    };
  } catch (error: any) {
    if (error?.name === "AbortError") return { ok: false, reason: "TIMEOUT" };
    return { ok: false, reason: "REQUEST_FAILED" };
  } finally {
    timeout.clear();
  }
}
