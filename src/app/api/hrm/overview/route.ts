import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHrmOverview } from "@/lib/hrm-monitoring";
import { beginApiMetric, endApiMetric } from "@/lib/api-observability";
import { reconcileWorkflowStatesIfDue } from "@/lib/workflow-reconciliation";

export const dynamic = "force-dynamic";

export async function GET() {
  const metric = beginApiMetric("GET /api/hrm/overview");
  try {
    const session = await auth();
    if (!session?.user) {
      endApiMetric(metric, { ok: false, status: 401, note: "unauthorized" });
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    await reconcileWorkflowStatesIfDue({ organizationId: user.organizationId, minIntervalMs: 45_000 });

    const data = await getHrmOverview({
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
    });

    endApiMetric(metric, { ok: true, status: 200 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_ROLE") {
      endApiMetric(metric, { ok: false, status: 403, note: "forbidden_role" });
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("[HRM_OVERVIEW_GET]", error);
    endApiMetric(metric, { ok: false, status: 500, note: "internal_error" });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
