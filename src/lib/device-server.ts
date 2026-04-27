import { Role, StaffStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrganizationCoreAccess } from "@/lib/billing-service";

export type SafeDeviceStaffSummary = {
  staffId: string;
  name: string;
  email: string;
  role: Role;
};

export function toSafeStaffSummary(staff: { id: string; fullName: string; email: string; role: Role }) {
  return {
    staffId: staff.id,
    name: staff.fullName,
    email: staff.email,
    role: staff.role,
  } satisfies SafeDeviceStaffSummary;
}

export async function requireSessionStaffContext() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };

  const actor = await prisma.staff.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      status: true,
      organizationId: true,
      fullName: true,
      email: true,
    },
  });
  if (!actor || actor.status !== StaffStatus.ACTIVE) {
    return { error: "Unauthorized", status: 401 as const };
  }
  if (!actor.organizationId) {
    return { error: "Organization not found", status: 404 as const };
  }

  try {
    const { organization } = await requireOrganizationCoreAccess(actor.organizationId);
    return { actor, organization };
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_LOCKED") {
      return {
        error: "Your organization subscription is not active",
        status: 403 as const,
      };
    }
    throw error;
  }
}

export async function ensureDeviceInOrganization(deviceKey: string, organizationId: string) {
  const device = await prisma.device.findUnique({
    where: { deviceKey },
    select: { id: true, deviceKey: true, organizationId: true, name: true, createdAt: true },
  });
  if (!device) return null;
  if (device.organizationId !== organizationId) return "OTHER_ORGANIZATION" as const;
  return device;
}
