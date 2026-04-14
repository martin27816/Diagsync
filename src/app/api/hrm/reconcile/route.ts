import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reconcileWorkflowStates } from "@/lib/workflow-reconciliation";
import { beginApiMetric, endApiMetric } from "@/lib/api-observability";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const metric = beginApiMetric("POST /api/hrm/reconcile");
  try {
    const session = await auth();
    if (!session?.user) {
      endApiMetric(metric, { ok: false, status: 401, note: "unauthorized" });
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    if (!["HRM", "SUPER_ADMIN"].includes(user.role)) {
      endApiMetric(metric, { ok: false, status: 403, note: "forbidden_role" });
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
    const data = await reconcileWorkflowStates({
      organizationId: user.organizationId,
      dryRun: Boolean(body?.dryRun),
    });

    endApiMetric(metric, { ok: true, status: 200, note: `updated_${data.updatedTasks}` });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[HRM_RECONCILE_POST]", error);
    endApiMetric(metric, { ok: false, status: 500, note: "internal_error" });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

