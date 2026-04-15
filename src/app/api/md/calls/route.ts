import { NextRequest, NextResponse } from "next/server";
import { Role, NotificationType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { sendNotificationToRoles } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  targetRole: z.enum(["RECEPTIONIST", "LAB_SCIENTIST", "HRM", "RADIOGRAPHER"]),
});

const TARGET_LABEL: Record<z.infer<typeof bodySchema>["targetRole"], string> = {
  RECEPTIONIST: "Receptionist",
  LAB_SCIENTIST: "Lab Scientist",
  HRM: "HRM",
  RADIOGRAPHER: "Radiographer",
};

function assertMdOrSuperAdmin(role: string) {
  if (!["MD", "SUPER_ADMIN"].includes(role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    assertMdOrSuperAdmin(user.role);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid payload" },
        { status: 400 }
      );
    }

    const targetRole = parsed.data.targetRole;
    const targetLabel = TARGET_LABEL[targetRole];
    const mdName = String(user.fullName ?? "MD");
    const dedupeStamp = Date.now();

    await sendNotificationToRoles({
      organizationId: user.organizationId,
      roles: [targetRole as Role],
      type: NotificationType.SYSTEM,
      title: "MD Wants To See You",
      message: `${mdName} requested ${targetLabel} support. Please report to MD now.`,
      entityType: "StaffCall",
      dedupeKeyPrefix: `md-call:${user.id}:${targetRole}:${dedupeStamp}`,
    });

    return NextResponse.json({
      success: true,
      data: { targetRole, targetLabel },
      message: `${targetLabel} has been notified.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_ROLE") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("[MD_CALLS_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

