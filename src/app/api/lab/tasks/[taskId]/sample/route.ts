import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditMetaFromRequest } from "@/lib/audit-core";
import { updateSampleForLabTask } from "@/lib/lab-workflow";
import { SampleStatus } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const sampleSchema = z.object({
  status: z.nativeEnum(SampleStatus),
  notes: z.string().max(500).optional(),
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

    const parsed = sampleSchema.safeParse(await req.json());
    if (!parsed.success) {
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

    return NextResponse.json({ success: true, message: "Sample updated" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE" || error.message === "FORBIDDEN_TASK") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
    }

    console.error("[LAB_TASK_SAMPLE]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
