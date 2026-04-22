import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { RoutingTaskStatus } from "@prisma/client";
import { getRadiologyTasks } from "@/lib/radiology-workflow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    if (user.role !== "RADIOGRAPHER") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") ?? "ALL";
    const sortParam = searchParams.get("sort") === "oldest" ? "oldest" : "newest";
    const searchParam = (searchParams.get("search") ?? "").trim();
    const dateParam = searchParams.get("date") ?? "";

    const status =
      statusParam === "ALL"
        ? "ALL"
        : (RoutingTaskStatus[statusParam as keyof typeof RoutingTaskStatus] ?? null);

    if (!status) {
      return NextResponse.json({ success: false, error: "Invalid status filter" }, { status: 400 });
    }

    const tasks = await getRadiologyTasks(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      { status, sort: sortParam, search: searchParam, date: dateParam }
    );

    const counts = {
      pending: tasks.filter((t) => t.status === "PENDING").length,
      inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      completed: tasks.filter((t) => t.status === "COMPLETED").length,
    };

    return NextResponse.json({ success: true, data: { tasks, counts } });
  } catch (error) {
    console.error("[RAD_TASKS_GET]", error);
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
