import { PrismaClient, Prisma } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

type CatalogSyncResult = {
  sourceOrganizationId: string | null;
  totalTemplateTests: number;
  syncedTests: number;
};

async function pickSourceOrganizationId(
  db: DbClient,
  targetOrganizationId: string
): Promise<string | null> {
  const configuredTemplateOrgId = process.env.CATALOG_TEMPLATE_ORG_ID?.trim();

  if (configuredTemplateOrgId && configuredTemplateOrgId !== targetOrganizationId) {
    const templateCount = await db.diagnosticTest.count({
      where: { organizationId: configuredTemplateOrgId },
    });
    if (templateCount > 0) {
      return configuredTemplateOrgId;
    }
  }

  const sourceGroup = await db.diagnosticTest.groupBy({
    by: ["organizationId"],
    where: {
      organizationId: { not: targetOrganizationId },
    },
    _count: { id: true },
    orderBy: {
      _count: { id: "desc" },
    },
    take: 1,
  });

  return sourceGroup[0]?.organizationId ?? null;
}

export async function syncFullTestCatalogToOrganization(
  db: DbClient,
  targetOrganizationId: string
): Promise<CatalogSyncResult> {
  const sourceOrganizationId = await pickSourceOrganizationId(db, targetOrganizationId);
  if (!sourceOrganizationId) {
    return {
      sourceOrganizationId: null,
      totalTemplateTests: 0,
      syncedTests: 0,
    };
  }

  const templateTests = await db.diagnosticTest.findMany({
    where: { organizationId: sourceOrganizationId },
    include: {
      resultFields: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const test of templateTests) {
    const targetTest = await db.diagnosticTest.upsert({
      where: {
        organizationId_code: {
          organizationId: targetOrganizationId,
          code: test.code,
        },
      },
      update: {
        categoryId: test.categoryId,
        name: test.name,
        type: test.type,
        department: test.department,
        price: test.price,
        costPrice: test.costPrice,
        turnaroundMinutes: test.turnaroundMinutes,
        sampleType: test.sampleType,
        description: test.description,
        isActive: test.isActive,
      },
      create: {
        organizationId: targetOrganizationId,
        categoryId: test.categoryId,
        name: test.name,
        code: test.code,
        type: test.type,
        department: test.department,
        price: test.price,
        costPrice: test.costPrice,
        turnaroundMinutes: test.turnaroundMinutes,
        sampleType: test.sampleType,
        description: test.description,
        isActive: test.isActive,
      },
      select: { id: true },
    });

    await db.resultTemplateField.deleteMany({
      where: { testId: targetTest.id },
    });

    if (test.resultFields.length > 0) {
      await db.resultTemplateField.createMany({
        data: test.resultFields.map((field) => ({
          testId: targetTest.id,
          label: field.label,
          fieldKey: field.fieldKey,
          fieldType: field.fieldType,
          unit: field.unit,
          normalMin: field.normalMin,
          normalMax: field.normalMax,
          normalText: field.normalText,
          referenceNote: field.referenceNote,
          options: field.options,
          isRequired: field.isRequired,
          sortOrder: field.sortOrder,
        })),
      });
    }
  }

  return {
    sourceOrganizationId,
    totalTemplateTests: templateTests.length,
    syncedTests: templateTests.length,
  };
}
