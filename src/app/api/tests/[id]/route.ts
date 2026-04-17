import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FieldType } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateRangeSchema = z.object({
  id: z.string().min(1),
  normalMin: z.number().nullable().optional(),
  normalMax: z.number().nullable().optional(),
  normalText: z.string().max(200).nullable().optional(),
  referenceNote: z.string().max(400).nullable().optional(),
});

const addFieldSchema = z.object({
  label: z.string().min(1, "Field label is required"),
  fieldKey: z.string().min(1, "Field key is required"),
  fieldType: z.nativeEnum(FieldType).default(FieldType.TEXT),
  unit: z.string().optional(),
  normalMin: z.number().nullable().optional(),
  normalMax: z.number().nullable().optional(),
  normalText: z.string().nullable().optional(),
  referenceNote: z.string().nullable().optional(),
  options: z.string().nullable().optional(),
  isRequired: z.boolean().optional(),
});

const updateTestSchema = z.object({
  rangeFields: z.array(updateRangeSchema).optional(),
  addFields: z.array(addFieldSchema).optional(),
});

function normalizeFieldKey(input: string) {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "custom_field";
}

// GET /api/tests/[id]
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
      return NextResponse.json({ success: false, error: "Test not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: test });
  } catch (error) {
    console.error("[TEST_GET_ID]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/tests/[id] - update default ranges and/or add new template fields
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
    if (!["LAB_SCIENTIST", "RECEPTIONIST", "HRM", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = updateTestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid payload" },
        { status: 400 }
      );
    }
    if (!parsed.data.rangeFields && !parsed.data.addFields) {
      return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
    }

    const test = await prisma.diagnosticTest.findFirst({
      where: { id: params.id, organizationId: user.organizationId, isActive: true },
      select: { id: true },
    });
    if (!test) {
      return NextResponse.json({ success: false, error: "Test not found" }, { status: 404 });
    }

    for (const row of parsed.data.rangeFields ?? []) {
      if (typeof row.normalMin === "number" && typeof row.normalMax === "number" && row.normalMin > row.normalMax) {
        return NextResponse.json(
          { success: false, error: "Normal min cannot be greater than normal max" },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (parsed.data.rangeFields) {
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
      }

      if (parsed.data.addFields && parsed.data.addFields.length > 0) {
        const existing = await tx.resultTemplateField.findMany({
          where: { testId: test.id },
          select: { fieldKey: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        });
        const usedKeys = new Set(existing.map((row) => row.fieldKey));
        let sortOrder = existing.length > 0 ? Math.max(...existing.map((row) => row.sortOrder)) + 1 : 0;

        for (const field of parsed.data.addFields) {
          const baseKey = normalizeFieldKey(field.fieldKey || field.label);
          let nextKey = baseKey;
          let suffix = 2;
          while (usedKeys.has(nextKey)) {
            nextKey = `${baseKey}_${suffix}`;
            suffix += 1;
          }
          usedKeys.add(nextKey);

          await tx.resultTemplateField.create({
            data: {
              testId: test.id,
              label: field.label.trim(),
              fieldKey: nextKey,
              fieldType: field.fieldType ?? FieldType.TEXT,
              unit: field.unit?.trim() || null,
              normalMin: field.normalMin ?? null,
              normalMax: field.normalMax ?? null,
              normalText: field.normalText?.trim() || null,
              referenceNote: field.referenceNote?.trim() || null,
              options: field.options?.trim() || null,
              isRequired: field.isRequired ?? false,
              sortOrder,
            },
          });
          sortOrder += 1;
        }
      }
    });

    const updated = await prisma.resultTemplateField.findMany({
      where: { testId: test.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: { resultFields: updated },
      message: "Test template updated",
    });
  } catch (error) {
    console.error("[TEST_PATCH_ID]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
