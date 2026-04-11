import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { overrideTask } from "@/lib/hrm-monitoring";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["RELEASE_TO_PENDING", "FORCE_COMPLETE"]),
  reason: z.string().max(1000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    await overrideTask(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      { taskId: params.taskId, ...parsed.data }
    );

    return NextResponse.json({ success: true, message: "Task override applied" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
    }
    console.error("[HRM_TASK_OVERRIDE]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

