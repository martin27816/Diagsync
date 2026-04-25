import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renderHtmlToPdfBuffer } from "@/lib/report-pdf";
import { renderReportForPreview } from "@/lib/report-workflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sanitizeForFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function GET(
  req: Request,
  { params }: { params: { reportId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
    const user = session.user as any;
    const url = new URL(req.url);
    const includeLetterhead = url.searchParams.get("letterhead") !== "without";

    const rendered = await renderReportForPreview(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      params.reportId,
      { includeLetterhead, showPrintButton: false, autoPrint: false, baseUrl: url.origin }
    );

    const pdfBuffer = await renderHtmlToPdfBuffer(rendered.html);
    const reportType =
      rendered.report.department === "LABORATORY" ? "lab" : "radiology";
    const patient = sanitizeForFileName(rendered.report.visit.patient.fullName.toLowerCase());
    const visit = sanitizeForFileName(rendered.report.visit.visitNumber.toLowerCase());
    const fileName = `${patient}-${visit}-${reportType}-report.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "BILLING_LOCKED") return new NextResponse("Billing access required", { status: 403 });
      if (error.message === "FORBIDDEN_ROLE") return new NextResponse("Forbidden", { status: 403 });
      if (error.message === "FORBIDDEN_UNRELEASED_REPORT") return new NextResponse("Forbidden", { status: 403 });
      if (error.message === "REPORT_NOT_FOUND") return new NextResponse("Report not found", { status: 404 });
      if (error.message === "REPORT_TYPE_MISMATCH") return new NextResponse("Invalid report state", { status: 409 });
      if (error.message === "CROSS_DEPARTMENT_CONTENT") return new NextResponse("Invalid report content", { status: 409 });
      if (error.message === "PDF_BROWSER_NOT_FOUND") return new NextResponse("PDF engine unavailable on server", { status: 500 });
      if (error.message.startsWith("Protocol error")) return new NextResponse("PDF rendering failed on server", { status: 500 });
    }
    console.error("[REPORT_PDF_GET]", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
