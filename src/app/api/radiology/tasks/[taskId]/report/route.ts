import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { saveRadiologyReport } from "@/lib/radiology-workflow";
import { validateCustomFieldsMap } from "@/lib/custom-fields-core";
import { SIGNOFF_IMAGE_KEY, SIGNOFF_NAME_KEY, isDataImageUrl } from "@/lib/report-signoff";
import { z } from "zod";

export const dynamic = "force-dynamic";

const reportSchema = z.object({
  findings: z.string().max(10000).default(""),
  impression: z.string().max(10000).default(""),
  notes: z.string().max(10000).optional(),
  extraFields: z.record(z.string().max(80), z.string().max(10000)).optional(),
  signatureName: z.string().max(120).optional(),
  signatureImage: z.string().max(400000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = reportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const customFieldsCheck = validateCustomFieldsMap(parsed.data.extraFields);
    if (!customFieldsCheck.ok) {
      return NextResponse.json({ success: false, error: customFieldsCheck.error }, { status: 400 });
    }

    const user = session.user as any;
    const signatureName = parsed.data.signatureName?.trim() ?? "";
    const signatureImage = parsed.data.signatureImage?.trim() ?? "";
    if ((signatureName || signatureImage) && (!signatureName || !signatureImage)) {
      return NextResponse.json({ success: false, error: "Signature image and name must be provided together" }, { status: 400 });
    }
    if (signatureImage && !isDataImageUrl(signatureImage)) {
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

    return NextResponse.json({ success: true, data: report, message: "Report draft saved" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE" || error.message === "FORBIDDEN_TASK") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
    }
    console.error("[RAD_TASK_REPORT]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
