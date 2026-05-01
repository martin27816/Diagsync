type WebsiteExtractedData = {
  description?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  images?: string[];
  source?: string;
  websiteText?: string;
};

export type WebsiteScrapeResult =
  | { ok: true; data: WebsiteExtractedData }
  | { ok: false; reason: "INVALID_WEBSITE" | "TIMEOUT" | "HTTP_ERROR" | "EMPTY_RESPONSE" | "REQUEST_FAILED"; status?: number };

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
}

function absoluteUrl(base: string, value: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function cleanText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function extractMetaDescription(html: string) {
  const m =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  return m?.[1] ? cleanText(m[1]) : undefined;
}

function extractOgImage(html: string, baseUrl: string) {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!m?.[1]) return undefined;
  return absoluteUrl(baseUrl, m[1]) ?? undefined;
}

function extractTitle(html: string) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? cleanText(m[1]) : undefined;
}

function extractPhones(text: string) {
  const matches = text.match(/(\+?\d[\d\s\-().]{6,}\d)/g) ?? [];
  const uniq = new Set<string>();
  for (const m of matches) {
    const value = m.trim();
    if (value.replace(/\D/g, "").length >= 7) uniq.add(value);
  }
  return Array.from(uniq);
}

function extractAddressLike(text: string) {
  const lines = text.split(/\n|\r/).map((l) => cleanText(l)).filter(Boolean);
  for (const line of lines) {
    if (line.length < 12) continue;
    if (/(road|street|close|avenue|estate|junction|lga|state|nigeria)/i.test(line)) return line;
  }
  return undefined;
}

function extractImageUrls(html: string, baseUrl: string) {
  const urls: string[] = [];
  const re = /<img[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    if (!srcMatch?.[1]) continue;
    const abs = absoluteUrl(baseUrl, srcMatch[1]);
    if (!abs || !/^https?:\/\//i.test(abs)) continue;
    const alt = (tag.match(/alt=["']([^"']*)["']/i)?.[1] ?? "").toLowerCase();
    const cls = (tag.match(/class=["']([^"']*)["']/i)?.[1] ?? "").toLowerCase();
    const text = `${abs} ${alt} ${cls}`;
    urls.push(text);
  }
  return urls;
}

function extractInternalLinks(html: string, baseUrl: string) {
  const links: string[] = [];
  const base = new URL(baseUrl);
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const next = absoluteUrl(baseUrl, m[1]);
    if (!next) continue;
    try {
      const parsed = new URL(next);
      if (parsed.hostname !== base.hostname) continue;
      if (!/^https?:$/i.test(parsed.protocol)) continue;
      if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip)$/i.test(parsed.pathname)) continue;
      if (/\#/.test(parsed.href)) continue;
      links.push(parsed.toString());
    } catch {
      continue;
    }
  }
  return Array.from(new Set(links));
}

function pickLogo(images: string[]) {
  const logoLike = images.find((u) => /logo|brand|header/i.test(u));
  if (!logoLike) return images[0];
  const firstUrl = logoLike.split(" ")[0];
  return firstUrl;
}

function filterMainImages(images: string[]) {
  const banned = /sprite|icon|avatar|favicon|googleusercontent|doubleclick|analytics|pixel|logo|brandmark|wordmark/i;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const img of images) {
    const url = img.split(" ")[0];
    if (!url) continue;
    if (banned.test(img)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= 30) break;
  }
  return out;
}

export async function scrapeLabWebsite(websiteUrl: string): Promise<WebsiteScrapeResult> {
  let normalized: URL;
  try {
    normalized = new URL(websiteUrl);
    if (!/^https?:$/i.test(normalized.protocol)) return { ok: false, reason: "INVALID_WEBSITE" };
  } catch {
    return { ok: false, reason: "INVALID_WEBSITE" };
  }

  const timeout = withTimeout(10_000);
  try {
    const res = await fetch(normalized.toString(), {
      method: "GET",
      headers: { "User-Agent": "DiagSyncBot/1.0 (+https://diagsync.vercel.app)" },
      signal: timeout.controller.signal,
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok) return { ok: false, reason: "HTTP_ERROR", status: res.status };
    const html = await res.text();
    if (!html || html.trim().length < 50) return { ok: false, reason: "EMPTY_RESPONSE" };

    const pages = [{ url: normalized.toString(), html }];
    const firstLinks = extractInternalLinks(html, normalized.toString());
    const rankedLinks = firstLinks
      .map((u) => {
        let score = 0;
        if (/(about|contact|services|diagnostic|laboratory|lab)/i.test(u)) score += 2;
        if (/(gallery|facility|facilities|equipment|branch|location|about-us|who-we-are)/i.test(u)) score += 3;
        if (/(blog|news|privacy|terms|policy|login|signup)/i.test(u)) score -= 3;
        return { u, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.u);

    for (const link of rankedLinks) {
      try {
        const pageRes = await fetch(link, {
          method: "GET",
          headers: { "User-Agent": "DiagSyncBot/1.0 (+https://diagsync.vercel.app)" },
          signal: timeout.controller.signal,
          cache: "no-store",
          redirect: "follow",
        });
        if (!pageRes.ok) continue;
        const pageHtml = await pageRes.text();
        if (pageHtml && pageHtml.trim().length >= 50) {
          pages.push({ url: link, html: pageHtml });
        }
      } catch {
        continue;
      }
    }

    const allText = pages
      .map((p) =>
        cleanText(
          p.html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, "\n")
        )
      )
      .join(" ");

    const allImagesRaw = pages.flatMap((p) => extractImageUrls(p.html, p.url));
    const images = filterMainImages(allImagesRaw).slice(0, 24);
    const ogImage = extractOgImage(html, normalized.toString());
    const logoUrl = ogImage || pickLogo(images);
    const phone = extractPhones(allText)[0];
    const description = extractMetaDescription(html) || extractTitle(html);
    const address = extractAddressLike(allText);
    const websiteText = allText.slice(0, 6000);

    return {
      ok: true,
      data: {
        description,
        phone,
        address,
        logoUrl,
        images,
        websiteText,
        source: "website-scrape-rules",
      },
    };
  } catch (error: any) {
    if (error?.name === "AbortError") return { ok: false, reason: "TIMEOUT" };
    return { ok: false, reason: "REQUEST_FAILED" };
  } finally {
    timeout.clear();
  }
}
