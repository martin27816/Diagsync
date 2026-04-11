import { Role, type Prisma } from "@prisma/client";

export type AuditMeta = {
  ipAddress?: string;
  userAgent?: string;
};

export function canViewAuditLogs(role: Role | string) {
  return role === "HRM" || role === "SUPER_ADMIN";
}

export function buildChangesPayload(input: {
  changes?: Prisma.InputJsonValue;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}) {
  if (input.changes !== undefined) return input.changes;
  if (input.oldValue !== undefined || input.newValue !== undefined) {
    return {
      before: input.oldValue ?? null,
      after: input.newValue ?? null,
    } as Prisma.InputJsonValue;
  }
  return undefined;
}

export function getAuditMetaFromRequest(req: Request | { headers: Headers }): AuditMeta {
  const headers = req.headers;
  const forwardedFor = headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? "";
  const ipAddress = forwardedFor.split(",")[0]?.trim() || undefined;
  const userAgent = headers.get("user-agent") ?? undefined;
  return { ipAddress, userAgent };
}
