import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { startRadiologyTask } from "@/lib/radiology-workflow";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;

    await startRadiologyTask(params.taskId, {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
      auditMeta: getAuditMetaFromRequest(req),
    });

    return NextResponse.json({ success: true, message: "Radiology task started" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE" || error.message === "FORBIDDEN_TASK") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "INVALID_TASK_STATE") {
        return NextResponse.json({ success: false, error: "Task cannot be started in current state" }, { status: 400 });
      }
    }
    console.error("[RAD_TASK_START]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
