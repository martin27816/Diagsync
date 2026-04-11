import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { startLabTask } from "@/lib/lab-workflow";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    await startLabTask(params.taskId, {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
    });

    return NextResponse.json({ success: true, message: "Task started" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE" || error.message === "FORBIDDEN_TASK") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "INVALID_TASK_STATE") {
        return NextResponse.json({ success: false, error: "Task cannot be started in current state" }, { status: 400 });
      }
    }

    console.error("[LAB_TASK_START]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

