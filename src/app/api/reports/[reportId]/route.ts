import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReportDetails } from "@/lib/report-workflow";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { reportId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;

    const data = await getReportDetails(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      params.reportId
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "BILLING_LOCKED") {
        return NextResponse.json(
          { success: false, error: "Billing access required. Please choose or renew a plan." },
          { status: 403 }
        );
      }
      if (error.message === "FORBIDDEN_ROLE") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "REPORT_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
      }
      if (error.message === "REPORT_TYPE_MISMATCH") {
        return NextResponse.json({ success: false, error: "Invalid report state" }, { status: 409 });
      }
      if (error.message === "FORBIDDEN_UNRELEASED_REPORT") {
        return NextResponse.json({ success: false, error: "Reception can only access released reports" }, { status: 403 });
      }
    }
    console.error("[REPORT_GET_ONE]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
