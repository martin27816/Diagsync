import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TestType, Department, FieldType } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const fieldSchema = z.object({
  label: z.string().min(1, "Field label is required"),
  fieldKey: z.string().min(1, "Field key is required"),
  fieldType: z.nativeEnum(FieldType),
  unit: z.string().optional(),
  normalMin: z.number().optional(),
  normalMax: z.number().optional(),
  options: z.string().optional(),
  isRequired: z.boolean().optional(),
});

const createTestSchema = z.object({
  name: z.string().min(2, "Test name is required"),
  code: z.string().min(2, "Test code is required"),
  type: z.nativeEnum(TestType),
  department: z.nativeEnum(Department),
  categoryId: z.string().optional(),
  price: z.number().min(0).optional(),
  turnaroundMinutes: z.number().int().min(1),
  sampleType: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(fieldSchema).min(1, "Add at least one result field"),
});

// GET /api/tests — list all active tests for the org
// Query params: ?search=fbc&type=LAB&department=LABORATORY
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") ?? "";
    const type = searchParams.get("type") as TestType | null;
    const department = searchParams.get("department") as Department | null;

    const tests = await prisma.diagnosticTest.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        ...(type ? { type } : {}),
        ...(department ? { department } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        resultFields: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, data: tests });
  } catch (error) {
    console.error("[TESTS_GET]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; organizationId: string };
    if (!["HRM", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = createTestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    const payload = parsed.data;
    const normalizedCode = payload.code.trim().toUpperCase();
    const normalizedName = payload.name.trim();

    if (payload.type === "LAB" && payload.department !== "LABORATORY") {
      return NextResponse.json({ success: false, error: "LAB tests must use LABORATORY department" }, { status: 400 });
    }
    if (payload.type === "RADIOLOGY" && payload.department !== "RADIOLOGY") {
      return NextResponse.json({ success: false, error: "RADIOLOGY tests must use RADIOLOGY department" }, { status: 400 });
    }

    const uniqueFieldKeys = new Set(payload.fields.map((field) => field.fieldKey.trim().toLowerCase()));
    if (uniqueFieldKeys.size !== payload.fields.length) {
      return NextResponse.json({ success: false, error: "Field keys must be unique" }, { status: 400 });
    }

    const category = payload.categoryId
      ? await prisma.testCategory.findUnique({ where: { id: payload.categoryId }, select: { id: true } })
      : null;
    if (payload.categoryId && !category) {
      return NextResponse.json({ success: false, error: "Selected category not found" }, { status: 400 });
    }

    const test = await prisma.$transaction(async (tx) => {
      const created = await tx.diagnosticTest.create({
        data: {
          organizationId: user.organizationId,
          categoryId: payload.categoryId || null,
          name: normalizedName,
          code: normalizedCode,
          type: payload.type,
          department: payload.department,
          price: payload.price ?? 0,
          turnaroundMinutes: payload.turnaroundMinutes,
          sampleType: payload.sampleType?.trim() || null,
          description: payload.description?.trim() || null,
        },
      });

      await tx.resultTemplateField.createMany({
        data: payload.fields.map((field, index) => ({
          testId: created.id,
          label: field.label.trim(),
          fieldKey: field.fieldKey.trim(),
          fieldType: field.fieldType,
          unit: field.unit?.trim() || null,
          normalMin: field.normalMin,
          normalMax: field.normalMax,
          options: field.options?.trim() || null,
          isRequired: field.isRequired ?? true,
          sortOrder: index,
        })),
      });

      return created;
    });

    return NextResponse.json({ success: true, data: { id: test.id }, message: "Test added successfully" }, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ success: false, error: "Test code already exists in this organization" }, { status: 409 });
    }
    console.error("[TESTS_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
