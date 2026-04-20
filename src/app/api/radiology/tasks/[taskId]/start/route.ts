import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { startRadiologyTask } from "@/lib/radiology-workflow";
import { beginApiMetric, endApiMetric } from "@/lib/api-observability";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const metric = beginApiMetric("PATCH /api/radiology/tasks/[taskId]/start");
  try {
    const session = await auth();
    if (!session?.user) {
      endApiMetric(metric, { ok: false, status: 401, note: "unauthorized" });
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;

    await startRadiologyTask(params.taskId, {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
      auditMeta: getAuditMetaFromRequest(req),
    });

    endApiMetric(metric, { ok: true, status: 200 });
    return NextResponse.json({ success: true, message: "Radiology task started" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE" || error.message === "FORBIDDEN_TASK") {
        endApiMetric(metric, { ok: false, status: 403, note: "forbidden" });
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        endApiMetric(metric, { ok: false, status: 404, note: "task_not_found" });
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "TASK_ALREADY_CLAIMED") {
        endApiMetric(metric, { ok: false, status: 409, note: "task_already_claimed" });
        return NextResponse.json({ success: false, error: "This task was already started by another radiographer." }, { status: 409 });
      }
      if (error.message === "INVALID_TASK_STATE") {
        endApiMetric(metric, { ok: false, status: 400, note: "invalid_state" });
        return NextResponse.json({ success: false, error: "Task cannot be started in current state" }, { status: 400 });
      }
    }
    console.error("[RAD_TASK_START]", error);
    endApiMetric(metric, { ok: false, status: 500, note: "internal_error" });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
