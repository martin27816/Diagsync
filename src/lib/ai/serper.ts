type SerperLabData = {
  description?: string;
  website?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  images?: string[];
  source?: string;
};

const BLOCKED_DOMAINS = [
  "unizik.edu.ng",
  "anambrastate.gov.ng",
  "wikipedia.org",
  "facebook.com/groups",
];

const GOOD_SIGNALS = ["diagnostic", "laboratory", "medical", "clinic"];

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

function isBlockedDomain(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return true;
  }
}

function hasGoodSignal(text: string) {
  const value = text.toLowerCase();
  return GOOD_SIGNALS.some((signal) => value.includes(signal));
}

function getLabTokens(labName: string) {
  return labName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !["medical", "center", "centre", "diagnostic", "diagnostics", "services"].includes(t));
}

function hasNameTokenMatch(text: string, labName: string) {
  const tokens = getLabTokens(labName);
  const value = text.toLowerCase();
  if (!tokens.length) return false;
  return tokens.some((t) => value.includes(t));
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
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const normalized = labName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hostNorm = host.replace(/[^a-z0-9]/g, "");
    const tokens = getLabTokens(labName);
    let score = 0;
    const isSocial = host.includes("facebook.com") || host.includes("instagram.com") || host.includes("linkedin.com");
    const isGov = host.endsWith(".gov.ng") || host.endsWith(".gov") || host.includes(".gov.");
    const isDirectoryPath = /\/(facilit|facilitie|facility|directory|listing|listings|places|businesses)\b/.test(path);
    const hasNameToken = tokens.some((t) => hostNorm.includes(t));
    const hasStrongName = hostNorm.includes(normalized.slice(0, Math.min(normalized.length, 8)));
    const isAcademic = host.includes(".edu") || host.includes(".ac.");
    const isProfilePath = /\/(profile|profiles|user|users|people|person)\b/.test(path);

    if (!isSocial) score += 2;
    if (hasStrongName) score += 5;
    if (hasNameToken) score += 4;
    if (isGov) score -= 3;
    if (isAcademic) score -= 4;
    if (isDirectoryPath) score -= 5;
    if (isProfilePath) score -= 6;
    if (path === "/" || path.length <= 1) score += 2;
    return score;
  } catch {
    return -1;
  }
}

export async function fetchLabDataWithSerper(labName: string, city?: string | null, state?: string | null): Promise<SerperFetchResult> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return { ok: false, reason: "MISSING_API_KEY" };

  const timeout = withTimeout(10_000);
  const query = [`"${labName}"`, city, state, "Nigeria", "laboratory", "medical diagnostic center website phone address"].filter(Boolean).join(" ");

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

    const candidatesStrict: string[] = [];
    const candidatesFallback: string[] = [];
    for (const row of organic) {
      if (typeof row?.link === "string") {
        const title = typeof row?.title === "string" ? row.title : "";
        const snippet = typeof row?.snippet === "string" ? row.snippet : "";
        if (isBlockedDomain(row.link)) continue;
        const hasSignal = hasGoodSignal(`${title} ${snippet} ${row.link}`);
        const hasNameMatch = hasNameTokenMatch(`${title} ${snippet}`, labName) || hasNameTokenMatch(row.link, labName);
        if (hasSignal && hasNameMatch) {
          candidatesStrict.push(row.link);
        }
        if (hasSignal || hasNameMatch) {
          candidatesFallback.push(row.link);
        }
      }
    }
    if (
      typeof knowledge?.website === "string" &&
      !isBlockedDomain(knowledge.website) &&
      hasGoodSignal(knowledge.website) &&
      hasNameTokenMatch(knowledge.website, labName)
    ) {
      candidatesStrict.push(knowledge.website);
    }
    if (typeof knowledge?.website === "string" && !isBlockedDomain(knowledge.website)) {
      candidatesFallback.push(knowledge.website);
    }
    const candidates = candidatesStrict.length > 0 ? candidatesStrict : candidatesFallback;

    let bestWebsite: string | null = null;
    let bestScore = -999;
    let bestHost = "";
    for (const link of candidates) {
      const normalized = normalizeUrl(link);
      if (!normalized) continue;
      if (isBlockedDomain(normalized)) continue;
      const score = scoreDomain(normalized, labName);
      const host = new URL(normalized).hostname.toLowerCase();
      if (score > bestScore) {
        bestScore = score;
        bestWebsite = normalized;
        bestHost = host;
      } else if (score === bestScore && bestWebsite) {
        // Prefer shortest path on same/close score.
        const currentPathLen = new URL(bestWebsite).pathname.length;
        const nextPathLen = new URL(normalized).pathname.length;
        if (nextPathLen < currentPathLen) {
          bestWebsite = normalized;
          bestHost = host;
        }
      }
    }

    // If selected URL is from a likely directory/government path, only keep it when no better candidate exists.
    if (bestWebsite) {
      const p = new URL(bestWebsite).pathname.toLowerCase();
      const suspiciousPath = /\/(facilit|facilitie|facility|directory|listing|listings|places|businesses)\b/.test(p);
      const suspiciousHost = bestHost.endsWith(".gov.ng") || bestHost.endsWith(".gov") || bestHost.includes(".gov.");
      if ((suspiciousPath || suspiciousHost) && bestScore < 8) {
        bestWebsite = null;
      }
    }

    const strictSnippets = organic
      .filter((row: any) => {
        const title = typeof row?.title === "string" ? row.title : "";
        const snippet = typeof row?.snippet === "string" ? row.snippet : "";
        return hasNameTokenMatch(`${title} ${snippet}`, labName);
      })
      .map((row: any) => (typeof row?.snippet === "string" ? row.snippet : ""))
      .filter(Boolean)
      .join(" ");
    const snippets = strictSnippets || organic
      .map((row: any) => (typeof row?.snippet === "string" ? row.snippet : ""))
      .filter((v: string) => Boolean(v) && hasGoodSignal(v))
      .join(" ");

    const phone =
      extractFirstPhone(typeof knowledge?.phoneNumber === "string" ? knowledge.phoneNumber : null) ||
      extractFirstPhone(snippets) ||
      undefined;

    const address =
      (typeof knowledge?.address === "string" && knowledge.address.trim()) ||
      (city ? `${city}${state ? `, ${state}` : ""}` : undefined);

    const description =
      (typeof knowledge?.description === "string" && hasNameTokenMatch(knowledge.description, labName) && knowledge.description.trim()) ||
      (typeof organic[0]?.snippet === "string" && hasNameTokenMatch(organic[0].snippet, labName) ? organic[0].snippet.trim() : undefined);

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
