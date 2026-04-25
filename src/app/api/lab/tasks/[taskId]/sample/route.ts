import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { updateSampleForLabTask } from "@/lib/lab-workflow";
import { SampleStatus } from "@prisma/client";
import { z } from "zod";
import { beginApiMetric, endApiMetric } from "@/lib/api-observability";

export const dynamic = "force-dynamic";

const sampleSchema = z.object({
  status: z.nativeEnum(SampleStatus),
  notes: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const metric = beginApiMetric("PATCH /api/lab/tasks/[taskId]/sample");
  try {
    const session = await auth();
    if (!session?.user) {
      endApiMetric(metric, { ok: false, status: 401, note: "unauthorized" });
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = sampleSchema.safeParse(await req.json());
    if (!parsed.success) {
      endApiMetric(metric, { ok: false, status: 400, note: "invalid_payload" });
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const user = session.user as any;
    await updateSampleForLabTask(
      params.taskId,
      {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
        auditMeta: getAuditMetaFromRequest(req),
      },
      parsed.data.status,
      parsed.data.notes
    );

    endApiMetric(metric, { ok: true, status: 200 });
    return NextResponse.json({ success: true, message: "Sample updated" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE" || error.message === "FORBIDDEN_TASK") {
        endApiMetric(metric, { ok: false, status: 403, note: "forbidden" });
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "BILLING_LOCKED") {
        endApiMetric(metric, { ok: false, status: 403, note: "billing_locked" });
        return NextResponse.json(
          { success: false, error: "Billing access required. Please choose or renew a plan." },
          { status: 403 }
        );
      }
      if (error.message === "TASK_NOT_FOUND") {
        endApiMetric(metric, { ok: false, status: 404, note: "task_not_found" });
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
    }

    console.error("[LAB_TASK_SAMPLE]", error);
    endApiMetric(metric, { ok: false, status: 500, note: "internal_error" });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
