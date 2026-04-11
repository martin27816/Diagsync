import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { releaseReport } from "@/lib/report-workflow";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  instructions: z.string().max(1000).optional(),
  method: z.enum(["PRINT", "DOWNLOAD", "WHATSAPP"]).default("PRINT"),
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

    await releaseReport(
      { id: user.id, role: user.role, organizationId: user.organizationId, auditMeta: getAuditMetaFromRequest(req) },
      { reportId: params.reportId, instructions: parsed.data.instructions, method: parsed.data.method }
    );
    return NextResponse.json({ success: true, message: "Report released" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      if (error.message === "REPORT_NOT_FOUND") return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
      if (error.message === "REPORT_ALREADY_RELEASED") return NextResponse.json({ success: false, error: "Report already released" }, { status: 409 });
      if (error.message === "REPORT_TYPE_MISMATCH") return NextResponse.json({ success: false, error: "Invalid report state" }, { status: 409 });
    }
    console.error("[REPORT_RELEASE_PATCH]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
