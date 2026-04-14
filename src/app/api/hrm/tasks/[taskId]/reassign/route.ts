import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { reassignTask } from "@/lib/hrm-monitoring";
import { z } from "zod";
import { beginApiMetric, endApiMetric } from "@/lib/api-observability";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  newStaffId: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const metric = beginApiMetric("PATCH /api/hrm/tasks/[taskId]/reassign");
  try {
    const session = await auth();
    if (!session?.user) {
      endApiMetric(metric, { ok: false, status: 401, note: "unauthorized" });
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      endApiMetric(metric, { ok: false, status: 400, note: "invalid_payload" });
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

    endApiMetric(metric, { ok: true, status: 200 });
    return NextResponse.json({ success: true, message: "Task reassigned successfully" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE") {
        endApiMetric(metric, { ok: false, status: 403, note: "forbidden" });
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        endApiMetric(metric, { ok: false, status: 404, note: "task_not_found" });
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "INVALID_ASSIGNEE" || error.message === "INVALID_ASSIGNEE_ROLE") {
        endApiMetric(metric, { ok: false, status: 400, note: "invalid_assignee" });
        return NextResponse.json({ success: false, error: "Invalid assignee for this task" }, { status: 400 });
      }
      if (error.message === "TASK_NOT_REASSIGNABLE") {
        endApiMetric(metric, { ok: false, status: 409, note: "task_not_reassignable" });
        return NextResponse.json(
          { success: false, error: "Completed or cancelled tasks cannot be reassigned" },
          { status: 409 }
        );
      }
    }
    console.error("[HRM_TASK_REASSIGN]", error);
    endApiMetric(metric, { ok: false, status: 500, note: "internal_error" });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
