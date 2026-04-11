import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@prisma/client";

interface AuditLogInput {
  actorId: string;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  notes?: string;
}

export async function createAuditLog(data: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        actorRole: data.actorRole,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        oldValue: data.oldValue ?? undefined,
        newValue: data.newValue ?? undefined,
        notes: data.notes,
      },
    });
  } catch (error) {
    // Audit logs should never crash the app — log silently
    console.error("[AUDIT_LOG_ERROR]", error);
  }
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
} as const;
