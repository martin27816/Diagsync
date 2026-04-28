import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { saveRadiologyReport } from "@/lib/radiology-workflow";
import { validateCustomFieldsMap } from "@/lib/custom-fields-core";
import { SIGNOFF_IMAGE_KEY, SIGNOFF_NAME_KEY, isDataImageUrl } from "@/lib/report-signoff";
import { z } from "zod";
import { beginApiMetric, endApiMetric } from "@/lib/api-observability";
import type { RadiologyPerTestSection } from "@/lib/radiology-report-sections";

export const dynamic = "force-dynamic";

const reportSchema = z.object({
  findings: z.string().max(10000).default(""),
  impression: z.string().max(10000).default(""),
  notes: z.string().max(10000).optional(),
  testReports: z
    .array(
      z.object({
        testOrderId: z.string().min(1),
        findings: z.string().max(10000).default(""),
        impression: z.string().max(10000).default(""),
        notes: z.string().max(10000).optional().default(""),
      })
    )
    .optional(),
  extraFields: z.record(z.string().max(80), z.string().max(10000)).optional(),
  signatureName: z.string().max(120).optional(),
  signatureImage: z.string().max(400000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const metric = beginApiMetric("POST /api/radiology/tasks/[taskId]/report");
  try {
    const session = await auth();
    if (!session?.user) {
      endApiMetric(metric, { ok: false, status: 401, note: "unauthorized" });
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = reportSchema.safeParse(await req.json());
    if (!parsed.success) {
      endApiMetric(metric, { ok: false, status: 400, note: "invalid_payload" });
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const customFieldsCheck = validateCustomFieldsMap(parsed.data.extraFields);
    if (!customFieldsCheck.ok) {
      endApiMetric(metric, { ok: false, status: 400, note: "invalid_extra_fields" });
      return NextResponse.json({ success: false, error: customFieldsCheck.error }, { status: 400 });
    }

    const user = session.user as any;
    const signatureName = parsed.data.signatureName?.trim() ?? "";
    const signatureImage = parsed.data.signatureImage?.trim() ?? "";
    if ((signatureName || signatureImage) && (!signatureName || !signatureImage)) {
      endApiMetric(metric, { ok: false, status: 400, note: "invalid_signature_pair" });
      return NextResponse.json({ success: false, error: "Signature image and name must be provided together" }, { status: 400 });
    }
    if (signatureImage && !isDataImageUrl(signatureImage)) {
      endApiMetric(metric, { ok: false, status: 400, note: "invalid_signature_format" });
      return NextResponse.json({ success: false, error: "Invalid signature image format" }, { status: 400 });
    }

    const report = await saveRadiologyReport(
      params.taskId,
      {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
        auditMeta: getAuditMetaFromRequest(req),
      },
      {
        ...parsed.data,
        testReports: (parsed.data.testReports ?? []) as RadiologyPerTestSection[],
        extraFields: {
          ...customFieldsCheck.value,
          ...(signatureName && signatureImage
            ? {
                [SIGNOFF_NAME_KEY]: signatureName,
                [SIGNOFF_IMAGE_KEY]: signatureImage,
              }
            : {}),
        },
      }
    );

    endApiMetric(metric, { ok: true, status: 200, note: "report_saved" });
    return NextResponse.json({ success: true, data: report, message: "Report draft saved" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE" || error.message === "FORBIDDEN_TASK") {
        endApiMetric(metric, { ok: false, status: 403, note: "forbidden" });
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "BILLING_LOCKED") {
        endApiMetric(metric, { ok: false, status: 403, note: "billing_locked" });
        return NextResponse.json({ success: false, error: "Billing access required. Please choose or renew a plan." }, { status: 403 });
      }
      if (error.message === "FEATURE_NOT_AVAILABLE") {
        endApiMetric(metric, { ok: false, status: 403, note: "feature_not_available" });
        return NextResponse.json({ success: false, error: "Radiology is available on Trial or Advanced plan." }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        endApiMetric(metric, { ok: false, status: 404, note: "task_not_found" });
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
    }
    console.error("[RAD_TASK_REPORT]", error);
    endApiMetric(metric, { ok: false, status: 500, note: "internal_error" });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
