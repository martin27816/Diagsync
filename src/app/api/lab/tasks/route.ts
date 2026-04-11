import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { RoutingTaskStatus } from "@prisma/client";
import { getLabTasks } from "@/lib/lab-workflow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== "LAB_SCIENTIST") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") ?? "ALL";
    const sortParam = searchParams.get("sort") === "oldest" ? "oldest" : "newest";

    const status =
      statusParam === "ALL"
        ? "ALL"
        : (RoutingTaskStatus[statusParam as keyof typeof RoutingTaskStatus] ?? null);

    if (!status) {
      return NextResponse.json({ success: false, error: "Invalid status filter" }, { status: 400 });
    }

    const tasks = await getLabTasks(
      {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
      },
      { status, sort: sortParam }
    );

    const counts = {
      pending: tasks.filter((t: any) => t.status === "PENDING").length,
      inProgress: tasks.filter((t: any) => t.status === "IN_PROGRESS").length,
      completed: tasks.filter((t: any) => t.status === "COMPLETED").length,
    };

    return NextResponse.json({ success: true, data: { tasks, counts } });
  } catch (error) {
    console.error("[LAB_TASKS_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

