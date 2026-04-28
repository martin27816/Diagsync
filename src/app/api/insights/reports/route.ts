import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    if (!["SUPER_ADMIN", "HRM", "MD"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    let reports: Awaited<ReturnType<typeof prisma.labInsightReport.findMany>> = [];
    try {
      reports = await prisma.labInsightReport.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
    } catch (error: any) {
      if (error?.code !== "P2021") {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      data: reports.map((report) => {
        const data = (report.data as Record<string, unknown>) ?? {};
        return {
          id: report.id,
          reportType: report.reportType,
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          createdAt: report.createdAt,
          summary: {
            revenue: typeof data.revenue === "number" ? data.revenue : 0,
            growth: typeof data.growth === "number" ? data.growth : 0,
            totalPatients: typeof data.totalPatients === "number" ? data.totalPatients : 0,
            delays: typeof data.delays === "number" ? data.delays : 0,
          },
          data,
        };
      }),
    });
  } catch (error) {
    console.error("[INSIGHTS_REPORTS_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
