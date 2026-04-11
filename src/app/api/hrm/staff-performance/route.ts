import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHrmStaffPerformance } from "@/lib/hrm-monitoring";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;

    const data = await getHrmStaffPerformance({
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_ROLE") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("[HRM_STAFF_PERF_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

