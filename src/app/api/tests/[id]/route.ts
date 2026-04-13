import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateRangeSchema = z.object({
  rangeFields: z
    .array(
      z.object({
        id: z.string().min(1),
        normalMin: z.number().nullable().optional(),
        normalMax: z.number().nullable().optional(),
        normalText: z.string().max(200).nullable().optional(),
        referenceNote: z.string().max(400).nullable().optional(),
      })
    )
    .min(1),
});

// GET /api/tests/[id] — get a single test with its result template fields
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;

    const test = await prisma.diagnosticTest.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId,
        isActive: true,
      },
      include: {
        category: true,
        resultFields: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!test) {
      return NextResponse.json(
        { success: false, error: "Test not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: test });
  } catch (error) {
    console.error("[TEST_GET_ID]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/tests/[id] — update default reference ranges for this test
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    if (!["RECEPTIONIST", "HRM", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = updateRangeSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    const test = await prisma.diagnosticTest.findFirst({
      where: { id: params.id, organizationId: user.organizationId, isActive: true },
      select: { id: true },
    });
    if (!test) {
      return NextResponse.json({ success: false, error: "Test not found" }, { status: 404 });
    }

    for (const row of parsed.data.rangeFields) {
      if (
        typeof row.normalMin === "number" &&
        typeof row.normalMax === "number" &&
        row.normalMin > row.normalMax
      ) {
        return NextResponse.json({ success: false, error: "Normal min cannot be greater than normal max" }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const row of parsed.data.rangeFields) {
        await tx.resultTemplateField.updateMany({
          where: { id: row.id, testId: test.id },
          data: {
            normalMin: row.normalMin === undefined ? undefined : row.normalMin,
            normalMax: row.normalMax === undefined ? undefined : row.normalMax,
            normalText:
              row.normalText === undefined
                ? undefined
                : row.normalText === null
                ? null
                : row.normalText.trim() || null,
            referenceNote:
              row.referenceNote === undefined
                ? undefined
                : row.referenceNote === null
                ? null
                : row.referenceNote.trim() || null,
          },
        });
      }
    });

    const updated = await prisma.resultTemplateField.findMany({
      where: { testId: test.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ success: true, data: { resultFields: updated }, message: "Ranges saved" });
  } catch (error) {
    console.error("[TEST_PATCH_ID]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
