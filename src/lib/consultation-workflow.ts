import { NotificationType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendNotification, sendNotificationToRoles } from "@/lib/notifications";
import { requireOrganizationCoreAccess } from "@/lib/billing-service";

export type ConsultationActor = {
  id: string;
  role: string;
  organizationId: string;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function todayDayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function shiftDayKey(dayKey: string, delta: number) {
  const [y, m, d] = dayKey.split("-").map((v) => Number(v));
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

function dayKeyToRangeUtc(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map((v) => Number(v));
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}

function assertReceptionOrMd(role: string) {
  if (!["RECEPTIONIST", "MD", "HRM", "SUPER_ADMIN"].includes(role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
}

async function assertConsultationCoreAccess(actor: ConsultationActor) {
  await requireOrganizationCoreAccess(actor.organizationId);
}

function dayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function normalizeConsultationTimeoutMinutes(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 10;
  return Math.max(1, Math.min(120, Number(value)));
}

async function getConsultationTimeoutMinutes(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { consultationTimeoutMinutes: true },
  });
  return normalizeConsultationTimeoutMinutes(org?.consultationTimeoutMinutes);
}

async function autoExpireCalledConsultations(organizationId: string) {
  const timeoutMinutes = await getConsultationTimeoutMinutes(organizationId);
  const now = new Date();
  const cutoff = new Date(now.getTime() - timeoutMinutes * 60 * 1000);

  const expired = await prisma.consultationQueue.findMany({
    where: {
      organizationId,
      status: "CALLED",
      calledAt: { lte: cutoff },
    },
    select: {
      id: true,
      fullName: true,
      age: true,
      calledAt: true,
    },
  });

  if (expired.length === 0) return { expiredCount: 0, timeoutMinutes };

  for (const item of expired) {
    const updateResult = await prisma.consultationQueue.updateMany({
      where: {
        id: item.id,
        organizationId,
        status: "CALLED",
      },
      data: {
        status: "CONSULTED",
        consultedAt: now,
      },
    });
    if (updateResult.count === 0) continue;

    await sendNotificationToRoles({
      organizationId,
      roles: [Role.MD],
      type: NotificationType.SYSTEM,
      title: "Consultation Time Up",
      message: `${item.fullName} (${item.age}y) reached ${timeoutMinutes} minutes and was auto-finished. Other patients may be waiting.`,
      entityId: item.id,
      entityType: "ConsultationQueue",
      dedupeKeyPrefix: `consultation-time-up:${item.id}:${item.calledAt?.toISOString() ?? "unknown"}`,
    });
  }

  return { expiredCount: expired.length, timeoutMinutes };
}

export async function listConsultationQueue(
  actor: ConsultationActor,
  opts?: { search?: string; date?: string; days?: number }
) {
  assertReceptionOrMd(actor.role);
  await assertConsultationCoreAccess(actor);
  const { timeoutMinutes } = await autoExpireCalledConsultations(actor.organizationId);
  const search = opts?.search?.trim() ?? "";
  const selectedDate =
    opts?.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : todayDayKey();
  const daysWindow = Math.max(1, Math.min(90, opts?.days ?? 14));
  const startDayKey = shiftDayKey(selectedDate, -(daysWindow - 1));
  const { end } = dayKeyToRangeUtc(selectedDate);
  const { start: rangeStart } = dayKeyToRangeUtc(startDayKey);
  const { start: todayStart, end: todayEnd } = dayRange();

  const searchFilter = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" as const } },
          { contact: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [active, consultedToday, history] = await Promise.all([
    prisma.consultationQueue.findMany({
      where: {
        organizationId: actor.organizationId,
        status: { in: ["WAITING", "CALLED"] },
        createdAt: { gte: rangeStart, lte: end },
        ...searchFilter,
      },
      orderBy: [{ arrivalAt: "asc" }],
      include: {
        createdBy: { select: { fullName: true } },
        calledBy: { select: { fullName: true } },
        acknowledgedBy: { select: { fullName: true } },
        consultedBy: { select: { fullName: true } },
      },
    }),
    prisma.consultationQueue.findMany({
      where: {
        organizationId: actor.organizationId,
        status: "CONSULTED",
        consultedAt: { gte: todayStart, lte: todayEnd },
        ...searchFilter,
      },
      orderBy: [{ consultedAt: "desc" }],
      take: 30,
      include: {
        acknowledgedBy: { select: { fullName: true } },
        consultedBy: { select: { fullName: true } },
      },
    }),
    prisma.consultationQueue.findMany({
      where: {
        organizationId: actor.organizationId,
        createdAt: { gte: rangeStart, lte: end },
        ...searchFilter,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: {
        createdBy: { select: { fullName: true } },
        calledBy: { select: { fullName: true } },
        acknowledgedBy: { select: { fullName: true } },
        consultedBy: { select: { fullName: true } },
      },
    }),
  ]);

  return {
    active,
    consultedToday,
    history,
    filters: { selectedDate, daysWindow, search },
    settings: { consultationTimeoutMinutes: timeoutMinutes },
  };
}

export async function addConsultationPatient(
  actor: ConsultationActor,
  input: { fullName: string; age: number; contact: string; vitalsNote?: string }
) {
  if (!["RECEPTIONIST", "SUPER_ADMIN"].includes(actor.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
  await assertConsultationCoreAccess(actor);

  const created = await prisma.consultationQueue.create({
    data: {
      organizationId: actor.organizationId,
      fullName: input.fullName.trim(),
      age: input.age,
      contact: input.contact.trim(),
      vitalsNote: input.vitalsNote?.trim() || null,
      createdById: actor.id,
    },
  });

  await sendNotificationToRoles({
    organizationId: actor.organizationId,
    roles: [Role.MD],
    type: NotificationType.SYSTEM,
    title: "New Consultation Patient",
    message: `${created.fullName} (${created.age}y) joined consultation queue.`,
    entityId: created.id,
    entityType: "ConsultationQueue",
    dedupeKeyPrefix: `consultation-new:${created.id}`,
  });

  return created;
}

export async function callConsultationPatient(actor: ConsultationActor, queueId: string) {
  if (!["MD", "SUPER_ADMIN"].includes(actor.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
  await assertConsultationCoreAccess(actor);

  const existing = await prisma.consultationQueue.findFirst({
    where: { id: queueId, organizationId: actor.organizationId },
  });
  if (!existing) throw new Error("QUEUE_NOT_FOUND");
  if (existing.status === "CONSULTED") throw new Error("ALREADY_CONSULTED");
  if (existing.status === "CANCELLED") throw new Error("QUEUE_CANCELLED");

  const updated = await prisma.consultationQueue.update({
    where: { id: existing.id },
    data: {
      status: "CALLED",
      calledAt: new Date(),
      calledById: actor.id,
    },
  });

  await sendNotificationToRoles({
    organizationId: actor.organizationId,
    roles: [Role.RECEPTIONIST],
    type: NotificationType.SYSTEM,
    title: "Patient Requested By MD",
    message: `Please bring in ${updated.fullName} (${updated.age}y) for consultation.`,
    entityId: updated.id,
    entityType: "ConsultationQueue",
    dedupeKeyPrefix: `consultation-call:${updated.id}:${updated.calledAt?.toISOString() ?? Date.now()}`,
  });

  return updated;
}

export async function markConsultationAsConsulted(actor: ConsultationActor, queueId: string) {
  if (!["MD", "SUPER_ADMIN"].includes(actor.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
  await assertConsultationCoreAccess(actor);

  const existing = await prisma.consultationQueue.findFirst({
    where: { id: queueId, organizationId: actor.organizationId },
  });
  if (!existing) throw new Error("QUEUE_NOT_FOUND");
  if (existing.status === "CONSULTED") throw new Error("ALREADY_CONSULTED");
  if (existing.status === "CANCELLED") throw new Error("QUEUE_CANCELLED");

  const updated = await prisma.consultationQueue.update({
    where: { id: existing.id },
    data: {
      status: "CONSULTED",
      consultedAt: new Date(),
      consultedById: actor.id,
    },
  });

  const mdUsers = await prisma.staff.findMany({
    where: {
      organizationId: actor.organizationId,
      role: "MD",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  for (const md of mdUsers) {
    await sendNotification({
      organizationId: actor.organizationId,
      userId: md.id,
      type: NotificationType.SYSTEM,
      title: "Patient Brought In",
      message: `${updated.fullName} is marked consulted by reception.`,
      entityId: updated.id,
      entityType: "ConsultationQueue",
      dedupeKey: `consultation-consulted:${updated.id}:${md.id}`,
    });
  }

  return updated;
}

export async function markConsultationPatientIn(actor: ConsultationActor, queueId: string) {
  if (!["RECEPTIONIST", "SUPER_ADMIN"].includes(actor.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
  await assertConsultationCoreAccess(actor);

  const existing = await prisma.consultationQueue.findFirst({
    where: { id: queueId, organizationId: actor.organizationId },
  });
  if (!existing) throw new Error("QUEUE_NOT_FOUND");
  if (existing.status === "CONSULTED") throw new Error("ALREADY_CONSULTED");
  if (existing.status === "CANCELLED") throw new Error("QUEUE_CANCELLED");

  const updated = await prisma.consultationQueue.update({
    where: { id: existing.id },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedById: actor.id,
      status: "CALLED",
    },
  });

  const mdUsers = await prisma.staff.findMany({
    where: {
      organizationId: actor.organizationId,
      role: "MD",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  for (const md of mdUsers) {
    await sendNotification({
      organizationId: actor.organizationId,
      userId: md.id,
      type: NotificationType.SYSTEM,
      title: "Patient Is In",
      message: `${updated.fullName} has been brought in by reception.`,
      entityId: updated.id,
      entityType: "ConsultationQueue",
      dedupeKey: `consultation-in:${updated.id}:${md.id}:${updated.acknowledgedAt?.toISOString() ?? Date.now()}`,
    });
  }

  return updated;
}
