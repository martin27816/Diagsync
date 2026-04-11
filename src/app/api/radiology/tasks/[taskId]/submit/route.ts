import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { submitRadiologyTask } from "@/lib/radiology-workflow";

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

    const body = await req.json().catch(() => ({}));
    const requireImaging = Boolean(body?.requireImaging);

    const user = session.user as any;
    await submitRadiologyTask(
      params.taskId,
      {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
        auditMeta: getAuditMetaFromRequest(req),
      },
      { requireImaging }
    );

    return NextResponse.json({ success: true, message: "Radiology report submitted for review" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE" || error.message === "FORBIDDEN_TASK") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "MISSING_REPORT") {
        return NextResponse.json({ success: false, error: "Please enter report before submission" }, { status: 400 });
      }
      if (error.message === "INCOMPLETE_REPORT") {
        return NextResponse.json({ success: false, error: "Findings and impression are required" }, { status: 400 });
      }
      if (error.message === "MISSING_IMAGING") {
        return NextResponse.json({ success: false, error: "Please upload imaging file(s) before submission" }, { status: 400 });
      }
      if (error.message === "TASK_ALREADY_COMPLETED") {
        return NextResponse.json({ success: false, error: "Task already submitted" }, { status: 409 });
      }
    }
    console.error("[RAD_TASK_SUBMIT]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
