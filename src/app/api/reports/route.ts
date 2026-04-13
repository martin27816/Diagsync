import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Department, ReportStatus, ReportType } from "@prisma/client";
import { listReports } from "@/lib/report-workflow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const { searchParams } = new URL(req.url);

    const department = (searchParams.get("department") ?? "ALL") as Department | "ALL";
    const status = (searchParams.get("status") ?? "ALL") as ReportStatus | "ALL";
    const reportType = (searchParams.get("reportType") ?? "ALL") as ReportType | "ALL";

    const data = await listReports(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      { department, status, reportType }
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_ROLE") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("[REPORTS_GET]", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        ...(process.env.NODE_ENV !== "production" ? { detail } : {}),
      },
      { status: 500 }
    );
  }
}
