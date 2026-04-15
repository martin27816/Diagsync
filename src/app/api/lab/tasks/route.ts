import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { RoutingTaskStatus } from "@prisma/client";
import { getLabTasks } from "@/lib/lab-workflow";
import { reconcileWorkflowStatesIfDue } from "@/lib/workflow-reconciliation";
import { beginApiMetric, endApiMetric } from "@/lib/api-observability";
import { prisma } from "@/lib/prisma";

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
    // Keep reconciliation running in background so task fetch is never blocked.
    void reconcileWorkflowStatesIfDue({
      organizationId: user.organizationId,
      minIntervalMs: 90_000,
    }).catch((error) => {
      console.error("[LAB_TASKS_RECONCILE_BG]", error);
    });

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") ?? "ACTIVE";
    const sortParam = searchParams.get("sort") === "oldest" ? "oldest" : "newest";

    const status =
      statusParam === "ALL" || statusParam === "ACTIVE"
        ? (statusParam as "ALL" | "ACTIVE")
        : (RoutingTaskStatus[statusParam as keyof typeof RoutingTaskStatus] ?? null);

    if (!status) {
      endApiMetric(metric, { ok: false, status: 400, note: "invalid_status_filter" });
      return NextResponse.json({ success: false, error: "Invalid status filter" }, { status: 400 });
    }

    const [tasks, groupedCounts] = await Promise.all([
      getLabTasks(
        {
          id: user.id,
          role: user.role,
          organizationId: user.organizationId,
        },
        { status, sort: sortParam }
      ),
      prisma.routingTask.groupBy({
        by: ["status"],
        where: {
          organizationId: user.organizationId,
          department: "LABORATORY",
          staffId: user.id,
        },
        _count: { status: true },
      }),
    ]);

    const counts = {
      pending: 0,
      inProgress: 0,
      completed: 0,
    };
    for (const item of groupedCounts) {
      if (item.status === "PENDING") counts.pending = item._count.status;
      if (item.status === "IN_PROGRESS") counts.inProgress = item._count.status;
      if (item.status === "COMPLETED") counts.completed = item._count.status;
    }

    endApiMetric(metric, { ok: true, status: 200 });
    return NextResponse.json({ success: true, data: { tasks, counts } });
  } catch (error) {
    console.error("[LAB_TASKS_GET]", error);
    endApiMetric(metric, { ok: false, status: 500, note: "internal_error" });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
