import { prisma } from "@/lib/prisma";

export function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "lab";
}

export async function ensureUniqueOrganizationSlug(baseName: string, excludeId?: string) {
  const base = slugify(baseName);
  let candidate = base;
  let suffix = 1;

  for (;;) {
    const existing = await prisma.organization.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
