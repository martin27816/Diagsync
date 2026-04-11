import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { editMdReview } from "@/lib/md-workflow";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  comments: z.string().max(1000).optional(),
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

    await editMdReview(
      params.taskId,
      { id: user.id, role: user.role, organizationId: user.organizationId },
      parsed.data as { editedData: any; comments?: string }
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
    }
    console.error("[MD_EDIT]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
