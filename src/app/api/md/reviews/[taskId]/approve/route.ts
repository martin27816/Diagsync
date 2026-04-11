import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { approveMdReview } from "@/lib/md-workflow";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  comments: z.string().max(1000).optional(),
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

    await approveMdReview(
      params.taskId,
      { id: user.id, role: user.role, organizationId: user.organizationId },
      parsed.data.comments
    );

    return NextResponse.json({ success: true, message: "Approved successfully" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "ALREADY_APPROVED") {
        return NextResponse.json({ success: false, error: "Already approved" }, { status: 409 });
      }
      if (error.message === "TASK_NOT_REVIEWABLE") {
        return NextResponse.json({ success: false, error: "Task is not reviewable" }, { status: 400 });
      }
      if (error.message === "NO_REVIEW_DATA") {
        return NextResponse.json({ success: false, error: "Cannot approve without submitted data to review" }, { status: 400 });
      }
    }

    console.error("[MD_APPROVE]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
