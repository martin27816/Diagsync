import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { submitLabTask } from "@/lib/lab-workflow";

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
    await submitLabTask(params.taskId, {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
      auditMeta: getAuditMetaFromRequest(req),
    });

    return NextResponse.json({ success: true, message: "Task completed and submitted for review" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE" || error.message === "FORBIDDEN_TASK") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "MISSING_RESULTS") {
        return NextResponse.json({ success: false, error: "Cannot complete task without all test results" }, { status: 400 });
      }
      if (error.message === "TASK_ALREADY_COMPLETED") {
        return NextResponse.json({ success: false, error: "Task already submitted" }, { status: 409 });
      }
    }

    console.error("[LAB_TASK_COMPLETE]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
