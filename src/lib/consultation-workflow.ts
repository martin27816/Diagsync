import { NotificationType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendNotification, sendNotificationToRoles } from "@/lib/notifications";

export type ConsultationActor = {
  id: string;
  role: string;
  organizationId: string;
};

function assertReceptionOrMd(role: string) {
  if (!["RECEPTIONIST", "MD", "SUPER_ADMIN"].includes(role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
}

function dayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function listConsultationQueue(actor: ConsultationActor) {
  assertReceptionOrMd(actor.role);
  const { start, end } = dayRange();

  const [active, consultedToday] = await Promise.all([
    prisma.consultationQueue.findMany({
      where: {
        organizationId: actor.organizationId,
        status: { in: ["WAITING", "CALLED"] },
      },
      orderBy: [{ arrivalAt: "asc" }],
      include: {
        createdBy: { select: { fullName: true } },
        calledBy: { select: { fullName: true } },
      },
    }),
    prisma.consultationQueue.findMany({
      where: {
        organizationId: actor.organizationId,
        status: "CONSULTED",
        consultedAt: { gte: start, lte: end },
      },
      orderBy: [{ consultedAt: "desc" }],
      take: 30,
      include: {
        acknowledgedBy: { select: { fullName: true } },
      },
    }),
  ]);

  return { active, consultedToday };
}

export async function addConsultationPatient(
  actor: ConsultationActor,
  input: { fullName: string; age: number; contact: string; vitalsNote?: string }
) {
  if (!["RECEPTIONIST", "SUPER_ADMIN"].includes(actor.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }

  return prisma.consultationQueue.create({
    data: {
      organizationId: actor.organizationId,
      fullName: input.fullName.trim(),
      age: input.age,
      contact: input.contact.trim(),
      vitalsNote: input.vitalsNote?.trim() || null,
      createdById: actor.id,
    },
  });
}

export async function callConsultationPatient(actor: ConsultationActor, queueId: string) {
  if (!["MD", "SUPER_ADMIN"].includes(actor.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }

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
  if (!["RECEPTIONIST", "SUPER_ADMIN"].includes(actor.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }

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
      acknowledgedAt: new Date(),
      acknowledgedById: actor.id,
      consultedAt: new Date(),
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

