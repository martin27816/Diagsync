import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveLabResults, submitLabTask } from "@/lib/lab-workflow";
import { z } from "zod";
import type { SaveResultInput } from "@/lib/lab-workflow";

export const dynamic = "force-dynamic";

const resultItemSchema = z.object({
  testOrderId: z.string().min(1),
  resultData: z.unknown().refine((v) => v !== undefined, { message: "resultData is required" }),
  notes: z.string().max(1000).optional(),
});

const saveResultsSchema = z.object({
  results: z.array(resultItemSchema).min(1),
  submit: z.boolean().default(false),
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

    const parsed = saveResultsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const user = session.user as any;
    const actor = {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };

    await saveLabResults(params.taskId, actor, parsed.data.results as SaveResultInput[]);
    if (parsed.data.submit) {
      await submitLabTask(params.taskId, actor);
      return NextResponse.json({ success: true, message: "Results submitted for review" });
    }

    return NextResponse.json({ success: true, message: "Draft results saved" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE" || error.message === "FORBIDDEN_TASK") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "INVALID_TEST_ORDER") {
        return NextResponse.json({ success: false, error: "Invalid test order for this task" }, { status: 400 });
      }
      if (error.message === "MISSING_RESULTS") {
        return NextResponse.json({ success: false, error: "Please enter results for all tests before submission" }, { status: 400 });
      }
      if (error.message === "TASK_ALREADY_COMPLETED") {
        return NextResponse.json({ success: false, error: "Task already submitted" }, { status: 409 });
      }
    }

    console.error("[LAB_TASK_RESULTS]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
