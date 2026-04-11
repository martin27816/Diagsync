import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { updateReportDraft } from "@/lib/report-workflow";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reportContent: z.unknown().optional(),
  comments: z.string().max(5000).optional().nullable(),
  prescription: z.string().max(5000).optional().nullable(),
  reason: z.string().min(3, "Edit reason is required"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    await updateReportDraft(
      { id: user.id, role: user.role, organizationId: user.organizationId, auditMeta: getAuditMetaFromRequest(req) },
      { reportId: params.reportId, ...parsed.data }
    );
    return NextResponse.json({ success: true, message: "Report draft updated" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      if (error.message === "REPORT_NOT_FOUND") return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
      if (error.message === "REASON_REQUIRED") return NextResponse.json({ success: false, error: "Edit reason is required" }, { status: 400 });
      if (error.message === "INVALID_REPORT_CONTENT") return NextResponse.json({ success: false, error: "Invalid report content" }, { status: 400 });
      if (error.message === "CROSS_DEPARTMENT_CONTENT") return NextResponse.json({ success: false, error: "Cannot mix lab and radiology report content" }, { status: 400 });
      if (error.message === "REPORT_ALREADY_RELEASED") return NextResponse.json({ success: false, error: "Released report cannot be edited" }, { status: 409 });
      if (error.message === "REPORT_TYPE_MISMATCH") return NextResponse.json({ success: false, error: "Invalid report state" }, { status: 409 });
    }
    console.error("[REPORT_DRAFT_PATCH]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
