import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { getReportDetails, trackReportAction } from "@/lib/report-workflow";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["PRINT", "DOWNLOAD", "SEND_WHATSAPP", "SEND_WHATSAPP_FAILED"]),
  notes: z.string().max(1000).optional(),
});

export async function POST(
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

    if (parsed.data.action === "SEND_WHATSAPP") {
      const report = await getReportDetails(
        { id: user.id, role: user.role, organizationId: user.organizationId },
        params.reportId
      );
      const rawPhone = report.visit.patient.phone ?? "";
      const phone = rawPhone.replace(/[^\d]/g, "");
      if (!phone) {
        await trackReportAction(
          { id: user.id, role: user.role, organizationId: user.organizationId, auditMeta: getAuditMetaFromRequest(req) },
          { reportId: params.reportId, action: "SEND_WHATSAPP_FAILED", notes: "Missing patient phone number" }
        );
        return NextResponse.json({ success: false, error: "Patient phone is missing for WhatsApp handoff" }, { status: 400 });
      }
      await trackReportAction(
        { id: user.id, role: user.role, organizationId: user.organizationId, auditMeta: getAuditMetaFromRequest(req) },
        { reportId: params.reportId, action: "SEND_WHATSAPP", notes: parsed.data.notes }
      );
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://diagsync.vercel.app";
      const publicUrl = `${appUrl}/public/reports/${report.publicShareToken}`;
      const text = encodeURIComponent(
        `Hello ${report.visit.patient.fullName}, your ${report.department === "LABORATORY" ? "Laboratory" : "Radiology"} report is ready: ${publicUrl}`
      );
      const waUrl = `https://wa.me/${phone}?text=${text}`;
      return NextResponse.json({
        success: true,
        data: { waUrl, limitation: "This opens WhatsApp handoff. Direct media sending requires WhatsApp Business API integration." },
      });
    }

    await trackReportAction(
      { id: user.id, role: user.role, organizationId: user.organizationId, auditMeta: getAuditMetaFromRequest(req) },
      { reportId: params.reportId, action: parsed.data.action, notes: parsed.data.notes }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      if (error.message === "REPORT_NOT_FOUND") return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
      if (error.message === "REPORT_NOT_RELEASED") return NextResponse.json({ success: false, error: "Report must be released first" }, { status: 409 });
      if (error.message === "REPORT_TYPE_MISMATCH") return NextResponse.json({ success: false, error: "Invalid report state" }, { status: 409 });
    }
    console.error("[REPORT_ACTION_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
