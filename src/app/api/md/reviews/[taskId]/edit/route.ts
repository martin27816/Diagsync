import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { editMdReview } from "@/lib/md-workflow";
import { validateCustomFieldsMap, validateResultDataPayload } from "@/lib/custom-fields-core";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  comments: z.string().max(1000).optional(),
  reason: z.string().min(3, "Edit reason is required"),
  editedData: z.unknown().refine((v) => v !== undefined, { message: "editedData is required" }),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const editedData = parsed.data.editedData as Record<string, unknown>;
    if (editedData && typeof editedData === "object") {
      const maybeReport = editedData["report"] as Record<string, unknown> | undefined;
      const maybeTestResults = editedData["testResults"];

      if (maybeReport && typeof maybeReport === "object") {
        const customFieldsCheck = validateCustomFieldsMap(maybeReport["extraFields"]);
        if (!customFieldsCheck.ok) {
          return NextResponse.json({ success: false, error: customFieldsCheck.error }, { status: 400 });
        }
        maybeReport["extraFields"] = customFieldsCheck.value;
      }

      if (Array.isArray(maybeTestResults)) {
        for (const row of maybeTestResults as Array<Record<string, unknown>>) {
          const resultDataCheck = validateResultDataPayload(row?.resultData);
          if (!resultDataCheck.ok) {
            return NextResponse.json({ success: false, error: resultDataCheck.error }, { status: 400 });
          }
        }
      }
    }

    await editMdReview(
      params.taskId,
      {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
        auditMeta: getAuditMetaFromRequest(req),
      },
      { ...parsed.data, editedData } as { editedData: any; reason: string; comments?: string }
    );

    return NextResponse.json({ success: true, message: "Edits saved for review" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "EDIT_AFTER_APPROVAL") {
        return NextResponse.json({ success: false, error: "Editing after approval is not allowed" }, { status: 409 });
      }
      if (error.message === "TASK_NOT_REVIEWABLE") {
        return NextResponse.json({ success: false, error: "Task is not reviewable" }, { status: 400 });
      }
      if (error.message === "REASON_REQUIRED") {
        return NextResponse.json({ success: false, error: "Edit reason is required" }, { status: 400 });
      }
      if (error.message === "INVALID_EDIT_DATA") {
        return NextResponse.json({ success: false, error: "Invalid edit payload for this task type" }, { status: 400 });
      }
      if (error.message === "RESULT_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Result/report not found for edit" }, { status: 404 });
      }
    }
    console.error("[MD_EDIT]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
