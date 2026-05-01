import { prisma } from "@/lib/prisma";
import { ensureUniqueOrganizationSlug } from "@/lib/slug";
import { fetchLabDataWithSerper } from "./serper";

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

  const fetched = await fetchLabDataWithSerper(org.name, org.city, org.state);
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
    images: Array.isArray(fetched.data.images)
      ? fetched.data.images.filter((v) => typeof v === "string" && /^https?:\/\//i.test(v.trim())).map((v) => v.trim())
      : [],
    phone: typeof fetched.data.phone === "string" ? fetched.data.phone.trim() : org.phone,
    address: typeof fetched.data.address === "string" ? fetched.data.address.trim() : org.address,
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
