import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TestType, Department, FieldType } from "@prisma/client";
import { z } from "zod";
import { canUseCardiology, canUseRadiology } from "@/lib/billing-access";
import { requireOrganizationCoreAccess } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

function normalizeTestNameForGrouping(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isCardiologyTest(payload: { name: string; code: string; description?: string | null; categoryName?: string | null }) {
  const token = `${payload.name} ${payload.code} ${payload.description ?? ""} ${payload.categoryName ?? ""}`.toLowerCase();
  return /(cardio|ecg|ekg|echo|echocardi|troponin|ck-mb)/.test(token);
}

const fieldSchema = z.object({
  label: z.string().min(1, "Field label is required"),
  fieldKey: z.string().min(1, "Field key is required"),
  fieldType: z.nativeEnum(FieldType),
  unit: z.string().optional(),
  normalMin: z.number().optional(),
  normalMax: z.number().optional(),
  normalText: z.string().optional(),
  referenceNote: z.string().optional(),
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
  costPrice: z.number().min(0).optional(),
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
    const { organization } = await requireOrganizationCoreAccess(user.organizationId);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") ?? "";
    const type = searchParams.get("type") as TestType | null;
    const department = searchParams.get("department") as Department | null;

    const normalizedSearch = search.trim().toLowerCase();
    const searchParts = normalizedSearch.split(/[^a-z0-9]+/).filter(Boolean);
    const hasMicroscopyWord = searchParts.some((part) => part.startsWith("micro"));
    const hasCultureWord = searchParts.some((part) => part.startsWith("culture"));
    const hasSensitivityWord = searchParts.some((part) => part.startsWith("sensitivity"));
    const hasMcsAlias =
      normalizedSearch.includes("m/c/s") ||
      normalizedSearch.includes("mcs") ||
      searchParts.join(" ").includes("m c s");
    const shouldExpandToMcs = hasMcsAlias || (hasMicroscopyWord && hasCultureWord && hasSensitivityWord);
    const trimmedSearch = search.trim();
    const searchVariants = new Set<string>();
    if (trimmedSearch) {
      searchVariants.add(trimmedSearch);
      searchVariants.add(trimmedSearch.replace(/\bxray\b/gi, "x-ray"));
      searchVariants.add(trimmedSearch.replace(/\bxray\b/gi, "x ray"));
      searchVariants.add(trimmedSearch.replace(/\bx-ray\b/gi, "xray"));
      searchVariants.add(trimmedSearch.replace(/\bx-ray\b/gi, "x ray"));
      searchVariants.add(trimmedSearch.replace(/\bx\s+ray\b/gi, "xray"));
      searchVariants.add(trimmedSearch.replace(/\bx\s+ray\b/gi, "x-ray"));
    }
    const searchTerms = Array.from(searchVariants).map((value) => value.trim()).filter(Boolean);

    const tests = await prisma.diagnosticTest.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        ...(canUseRadiology(organization) ? {} : { department: { not: Department.RADIOLOGY } }),
        ...(type ? { type } : {}),
        ...(department ? { department } : {}),
        ...(searchTerms.length > 0
          ? {
              OR: [
                ...searchTerms.flatMap((term) => [
                  { name: { contains: term, mode: "insensitive" as const } },
                  { code: { contains: term, mode: "insensitive" as const } },
                ]),
                ...(shouldExpandToMcs ? [{ name: { contains: "M/C/S", mode: "insensitive" as const } }] : []),
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

    const scoreTest = (test: (typeof tests)[number]) => {
      const fields = test.resultFields ?? [];
      const numericWithRange = fields.filter(
        (field) =>
          field.fieldType === FieldType.NUMBER &&
          field.normalMin !== null &&
          field.normalMax !== null
      ).length;
      const fieldsWithNormalText = fields.filter(
        (field) => (field.normalText ?? "").trim().length > 0
      ).length;
      return numericWithRange * 100 + fieldsWithNormalText * 10 + fields.length;
    };

    const groupedBestByName = new Map<string, (typeof tests)[number]>();
    for (const test of tests) {
      const key = normalizeTestNameForGrouping(test.name);
      const current = groupedBestByName.get(key);
      if (!current) {
        groupedBestByName.set(key, test);
        continue;
      }
      const currentScore = scoreTest(current);
      const nextScore = scoreTest(test);
      if (nextScore > currentScore) {
        groupedBestByName.set(key, test);
        continue;
      }
      if (nextScore === currentScore && test.updatedAt > current.updatedAt) {
        groupedBestByName.set(key, test);
      }
    }

    const dedupedTests = Array.from(groupedBestByName.values()).sort((a, b) => {
      const typeCmp = a.type.localeCompare(b.type);
      if (typeCmp !== 0) return typeCmp;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ success: true, data: dedupedTests });
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_LOCKED") {
      return NextResponse.json(
        { success: false, error: "Billing access required. Please choose or renew a plan." },
        { status: 403 }
      );
    }
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
    const { organization } = await requireOrganizationCoreAccess(user.organizationId);
    if (!["RECEPTIONIST", "HRM", "SUPER_ADMIN"].includes(user.role)) {
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
    if (payload.department === "RADIOLOGY" && !canUseRadiology(organization)) {
      return NextResponse.json(
        { success: false, error: "Radiology tests are available on Trial or Advanced plan." },
        { status: 403 }
      );
    }

    const uniqueFieldKeys = new Set(payload.fields.map((field) => field.fieldKey.trim().toLowerCase()));
    if (uniqueFieldKeys.size !== payload.fields.length) {
      return NextResponse.json({ success: false, error: "Field keys must be unique" }, { status: 400 });
    }
    for (const field of payload.fields) {
      const hasMin = field.normalMin !== undefined;
      const hasMax = field.normalMax !== undefined;
      if (field.fieldType === FieldType.NUMBER && hasMin !== hasMax) {
        return NextResponse.json(
          { success: false, error: `Numeric field "${field.label}" must include both normal min and max.` },
          { status: 400 }
        );
      }
    }

    const category = payload.categoryId
      ? await prisma.testCategory.findUnique({ where: { id: payload.categoryId }, select: { id: true, name: true } })
      : null;
    if (payload.categoryId && !category) {
      return NextResponse.json({ success: false, error: "Selected category not found" }, { status: 400 });
    }
    if (
      !canUseCardiology(organization) &&
      isCardiologyTest({
        name: payload.name,
        code: payload.code,
        description: payload.description,
        categoryName: category?.name ?? null,
      })
    ) {
      return NextResponse.json(
        { success: false, error: "Cardiology tests are available on Trial or Advanced plan." },
        { status: 403 }
      );
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
          costPrice: payload.costPrice ?? 0,
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
          normalText: field.normalText?.trim() || null,
          referenceNote: field.referenceNote?.trim() || null,
          options: field.options?.trim() || null,
          isRequired: field.isRequired ?? true,
          sortOrder: index,
        })),
      });

      return created;
    });

    return NextResponse.json({ success: true, data: { id: test.id }, message: "Test added successfully" }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "BILLING_LOCKED") {
      return NextResponse.json(
        { success: false, error: "Billing access required. Please choose or renew a plan." },
        { status: 403 }
      );
    }
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
