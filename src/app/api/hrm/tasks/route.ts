import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Department, Priority, RoutingTaskStatus } from "@prisma/client";
import { getHrmTaskMonitor } from "@/lib/hrm-monitoring";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;

    const { searchParams } = new URL(req.url);
    const department = (searchParams.get("department") ?? "ALL") as Department | "ALL";
    const status = (searchParams.get("status") ?? "ALL") as RoutingTaskStatus | "ALL";
    const priority = (searchParams.get("priority") ?? "ALL") as Priority | "ALL";

    const data = await getHrmTaskMonitor(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      { department, status, priority }
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_ROLE") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("[HRM_TASKS_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

