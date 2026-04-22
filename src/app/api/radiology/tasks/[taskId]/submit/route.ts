import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { submitRadiologyTask } from "@/lib/radiology-workflow";
import { beginApiMetric, endApiMetric } from "@/lib/api-observability";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const metric = beginApiMetric("PATCH /api/radiology/tasks/[taskId]/submit");
  try {
    const session = await auth();
    if (!session?.user) {
      endApiMetric(metric, { ok: false, status: 401, note: "unauthorized" });
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    await submitRadiologyTask(
      params.taskId,
      {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
        auditMeta: getAuditMetaFromRequest(req),
      }
    );

    endApiMetric(metric, { ok: true, status: 200, note: "submitted" });
    return NextResponse.json({ success: true, message: "Radiology report submitted for review" });
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
      if (error.message === "MISSING_REPORT") {
        endApiMetric(metric, { ok: false, status: 400, note: "missing_report" });
        return NextResponse.json({ success: false, error: "Please enter report before submission" }, { status: 400 });
      }
      if (error.message.startsWith("INCOMPLETE_REPORT")) {
        const detail = error.message.split(":").slice(1).join(":").trim();
        endApiMetric(metric, { ok: false, status: 400, note: "incomplete_report" });
        return NextResponse.json(
          {
            success: false,
            error:
              detail.length > 0
                ? `Cannot submit. Missing report section(s): ${detail}`
                : "Findings and impression are required",
          },
          { status: 400 }
        );
      }
      if (error.message === "TASK_ALREADY_COMPLETED") {
        endApiMetric(metric, { ok: false, status: 409, note: "task_already_submitted" });
        return NextResponse.json({ success: false, error: "Task already submitted" }, { status: 409 });
      }
    }
    console.error("[RAD_TASK_SUBMIT]", error);
    endApiMetric(metric, { ok: false, status: 500, note: "internal_error" });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
