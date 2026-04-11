import { NotificationType, Role } from "@prisma/client";

export function canAccessNotification(targetUserId: string, actorUserId: string) {
  return targetUserId === actorUserId;
}

export function buildNotificationDedupeKey(input: {
  userId: string;
  type: NotificationType;
  entityId?: string | null;
  key?: string | null;
}) {
  if (input.key) return input.key;
  if (!input.entityId) return null;
  return `${input.userId}:${input.type}:${input.entityId}`;
}

export function isPrivilegedOpsRole(role: Role | string) {
  return role === "HRM" || role === "SUPER_ADMIN";
}

export function mapTaskDepartmentToRole(department: string) {
  if (department === "LABORATORY") return "LAB_SCIENTIST" as const;
  if (department === "RADIOLOGY") return "RADIOGRAPHER" as const;
  return null;
}
