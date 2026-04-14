import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { RoutingTaskStatus } from "@prisma/client";
import { getLabTasks } from "@/lib/lab-workflow";
import { reconcileWorkflowStatesIfDue } from "@/lib/workflow-reconciliation";
import { beginApiMetric, endApiMetric } from "@/lib/api-observability";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const metric = beginApiMetric("GET /api/lab/tasks");
  try {
    const session = await auth();
    if (!session?.user) {
      endApiMetric(metric, { ok: false, status: 401, note: "unauthorized" });
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== "LAB_SCIENTIST") {
      endApiMetric(metric, { ok: false, status: 403, note: "forbidden" });
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await reconcileWorkflowStatesIfDue({ organizationId: user.organizationId, minIntervalMs: 45_000 });

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") ?? "ALL";
    const sortParam = searchParams.get("sort") === "oldest" ? "oldest" : "newest";

    const status =
      statusParam === "ALL"
        ? "ALL"
        : (RoutingTaskStatus[statusParam as keyof typeof RoutingTaskStatus] ?? null);

    if (!status) {
      endApiMetric(metric, { ok: false, status: 400, note: "invalid_status_filter" });
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

    endApiMetric(metric, { ok: true, status: 200 });
    return NextResponse.json({ success: true, data: { tasks, counts } });
  } catch (error) {
    console.error("[LAB_TASKS_GET]", error);
    endApiMetric(metric, { ok: false, status: 500, note: "internal_error" });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
