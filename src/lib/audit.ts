import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@prisma/client";
import { buildChangesPayload, type AuditMeta } from "./audit-core";

interface AuditLogInput {
  actorId: string;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Prisma.InputJsonValue;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface LogActionInput extends AuditMeta {
  userId: string;
  userRole: Role;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Prisma.InputJsonValue;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  notes?: string;
}

export async function logAction(data: LogActionInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: data.userId,
        actorRole: data.userRole,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        changes: buildChangesPayload(data),
        oldValue: data.oldValue ?? undefined,
        newValue: data.newValue ?? undefined,
        notes: data.notes,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    // Audit logs should never crash the app — log silently
    console.error("[AUDIT_LOG_ERROR]", error);
  }
}

export async function createAuditLog(data: AuditLogInput) {
  return logAction({
    userId: data.actorId,
    userRole: data.actorRole,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    changes: data.changes,
    oldValue: data.oldValue,
    newValue: data.newValue,
    notes: data.notes,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });
}

export const AUDIT_ACTIONS = {
  // Organization
  ORG_CREATED: "ORGANIZATION_CREATED",
  ORG_UPDATED: "ORGANIZATION_UPDATED",

  // Staff
  STAFF_CREATED: "STAFF_CREATED",
  STAFF_UPDATED: "STAFF_UPDATED",
  STAFF_DEACTIVATED: "STAFF_DEACTIVATED",
  STAFF_LOGIN: "STAFF_LOGIN",
  STAFF_LOGOUT: "STAFF_LOGOUT",
  AVAILABILITY_CHANGED: "AVAILABILITY_CHANGED",

  // Phase 3 — Patient & Visit
  PATIENT_REGISTERED: "PATIENT_REGISTERED",
  PATIENT_UPDATED: "PATIENT_UPDATED",
  VISIT_CREATED: "VISIT_CREATED",
  PAYMENT_UPDATED: "PAYMENT_UPDATED",

  // Phase 3 — Test Orders & Routing
  TEST_ORDERED: "TEST_ORDERED",
  TEST_ASSIGNED: "TEST_ASSIGNED",
  TEST_REASSIGNED: "TEST_REASSIGNED",
  TEST_ACCEPTED: "TEST_ACCEPTED",

  // Phase 5+ — Lab workflow
  SAMPLE_COLLECTED: "SAMPLE_COLLECTED",
  TEST_STARTED: "TEST_STARTED",
  RESULT_DRAFTED: "RESULT_DRAFTED",
  RESULT_SUBMITTED: "RESULT_SUBMITTED",
  EDIT_REQUESTED: "EDIT_REQUESTED",
  REVIEW_EDITED: "REVIEW_EDITED",
  RESULT_REJECTED: "RESULT_REJECTED",
  RESULT_RESUBMITTED: "RESULT_RESUBMITTED",
  RESULT_APPROVED: "RESULT_APPROVED",
  RESULT_RELEASED: "RESULT_RELEASED",
  RESULT_CANCELLED: "RESULT_CANCELLED",
  TASK_OVERRIDDEN: "TASK_OVERRIDDEN",
} as const;
