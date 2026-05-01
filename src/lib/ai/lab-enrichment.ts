import { prisma } from "@/lib/prisma";
import { ensureUniqueOrganizationSlug } from "@/lib/slug";
import { fetchLabDataWithSerper } from "./serper";
import { scrapeLabWebsite } from "./website-scrape";
import { refineLabDataWithGemini } from "./gemini";

function isValidHttpUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanDescription(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().slice(0, 500);
}

function cleanPhone(value: string | null | undefined) {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length > 40) return null;
  const hasDigits = compact.replace(/\D/g, "").length >= 7;
  return hasDigits ? compact : null;
}

function cleanAddress(value: string | null | undefined) {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length < 10) return null;
  if (compact.length > 180) return null;
  if (/home about services gallery contact book now/i.test(compact)) return null;
  return compact;
}

function cleanImages(images: string[] | undefined) {
  if (!Array.isArray(images)) return [];
  const banned = /icon|favicon|sprite|pixel|avatar|thumb|logo-small|placeholder/i;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const img of images) {
    if (typeof img !== "string") continue;
    const u = img.trim();
    if (!/^https:\/\//i.test(u)) continue;
    if (banned.test(u)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= 24) break;
  }
  return out;
}

function containsCity(address: string | null | undefined, city: string | null | undefined) {
  if (!address || !city) return false;
  return address.toLowerCase().includes(city.toLowerCase());
}

function computeConfidence(input: {
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  description?: string | null;
}) {
  let score = 0.5;
  if (isValidHttpUrl(input.website)) score += 0.1;
  if (input.phone && /[0-9]{7,}/.test(input.phone.replace(/\D/g, ""))) score += 0.1;
  if (containsCity(input.address, input.city)) score += 0.1;
  if (input.description && input.description.trim().length > 0) score += 0.1;
  return Math.min(1, score);
}

export async function enrichOrganizationWithAi(organizationId: string, opts?: { force?: boolean }) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      address: true,
      phone: true,
      description: true,
      website: true,
      logoUrl: true,
      images: true,
      slug: true,
      lastFetchedAt: true,
    },
  });

  if (!org) return { ok: false as const, reason: "NOT_FOUND" as const };

  const now = new Date();
  if (!opts?.force && org.lastFetchedAt && now.getTime() - org.lastFetchedAt.getTime() < 60 * 60 * 1000) {
    return { ok: false as const, reason: "RATE_LIMITED" as const };
  }

  let fetched:
    | { ok: true; data: { description?: string; website?: string; phone?: string; address?: string; logoUrl?: string; images?: string[]; source?: string } }
    | { ok: false; reason: string; status?: number };
  const fromSerper = await fetchLabDataWithSerper(org.name, org.city, org.state);
  const candidateWebsite =
    (isValidHttpUrl(org.website) ? org.website : null) ||
    (fromSerper.ok ? fromSerper.data.website ?? fromSerper.data.topResults?.[0]?.link : null);

  if (candidateWebsite && isValidHttpUrl(candidateWebsite)) {
    const fromWebsite = await scrapeLabWebsite(candidateWebsite);
    if (fromWebsite.ok) {
      const baseData = {
        ...fromWebsite.data,
        website: candidateWebsite,
      };

      const maybeGemini = await refineLabDataWithGemini({
        labName: org.name,
        city: org.city,
        state: org.state,
        snippets: fromSerper.ok ? fromSerper.data.snippets : [],
        websiteContent: fromWebsite.data.websiteText,
        candidateWebsite,
        candidateLogoUrl: fromWebsite.data.logoUrl,
        candidateImages: fromWebsite.data.images,
      });

      fetched =
        maybeGemini.ok
          ? {
              ok: true,
              data: {
                ...baseData,
                ...maybeGemini.data,
                website: maybeGemini.data.website || baseData.website,
                source: "website+serper+gemini",
              },
            }
          : { ok: true, data: baseData };
    } else if (fromSerper.ok) {
      fetched = fromSerper;
    } else {
      fetched = {
        ok: false,
        reason: `WEBSITE_${fromWebsite.reason}`,
        status: fromWebsite.status ?? fromSerper.status,
      };
    }
  } else {
    fetched = fromSerper.ok ? fromSerper : { ok: false, reason: fromSerper.reason, status: fromSerper.status };
  }
  const nextSlug = org.slug || (await ensureUniqueOrganizationSlug(org.name, org.id));

  if (!fetched.ok) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { lastFetchedAt: now, slug: nextSlug },
    });
    return {
      ok: false as const,
      reason: "NO_AI_DATA" as const,
      aiReason: fetched.reason,
      aiStatus: fetched.status,
    };
  }

  const cleaned = {
    description: cleanDescription(fetched.data.description),
    website: isValidHttpUrl(fetched.data.website) ? fetched.data.website!.trim() : null,
    logoUrl: isValidHttpUrl(fetched.data.logoUrl) ? fetched.data.logoUrl!.trim() : null,
    images: cleanImages(fetched.data.images),
    phone: cleanPhone(typeof fetched.data.phone === "string" ? fetched.data.phone : null) ?? org.phone,
    address: cleanAddress(typeof fetched.data.address === "string" ? fetched.data.address : null) ?? org.address,
    source: typeof fetched.data.source === "string" ? fetched.data.source.trim().slice(0, 200) : "serper-search-rules",
  };

  const confidence = computeConfidence({
    website: cleaned.website,
    phone: cleaned.phone,
    address: cleaned.address,
    city: org.city,
    description: cleaned.description,
  });

  if (confidence >= 0.75) {
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        description: cleaned.description || org.description,
        website: cleaned.website ?? org.website,
        logoUrl: cleaned.logoUrl ?? org.logoUrl,
        images: cleaned.images.length > 0 ? cleaned.images : org.images,
        phone: cleaned.phone || org.phone,
        address: cleaned.address || org.address,
        aiConfidence: confidence,
        aiSource: cleaned.source,
        lastFetchedAt: now,
        slug: nextSlug,
      },
    });
    return { ok: true as const, confidence };
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      aiConfidence: confidence,
      aiSource: cleaned.source,
      lastFetchedAt: now,
      slug: nextSlug,
    },
  });
  return { ok: false as const, reason: "LOW_CONFIDENCE" as const, confidence };
}
