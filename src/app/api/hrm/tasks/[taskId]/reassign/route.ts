import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { reassignTask } from "@/lib/hrm-monitoring";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  newStaffId: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    await reassignTask(
      {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
        auditMeta: getAuditMetaFromRequest(req),
      },
      { taskId: params.taskId, ...parsed.data }
    );

    return NextResponse.json({ success: true, message: "Task reassigned successfully" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "INVALID_ASSIGNEE" || error.message === "INVALID_ASSIGNEE_ROLE") {
        return NextResponse.json({ success: false, error: "Invalid assignee for this task" }, { status: 400 });
      }
    }
    console.error("[HRM_TASK_REASSIGN]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
