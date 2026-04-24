import { prisma } from "@/lib/prisma";

export async function getGroupedRadiologyTests(params: {
  organizationId: string;
  groupKey: string;
}) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      organizationId: string;
      categoryId: string | null;
      name: string;
      code: string;
      type: string;
      department: string;
      price: unknown;
      costPrice: unknown;
      turnaroundMinutes: number;
      sampleType: string | null;
      description: string | null;
      groupKey: string | null;
      viewType: string | null;
      isDefaultInGroup: boolean;
      isActive: boolean;
    }>
  >`
    SELECT *
    FROM "diagnostic_tests"
    WHERE "organizationId" = ${params.organizationId}
      AND "type" = 'RADIOLOGY'
      AND "groupKey" = ${params.groupKey}
      AND "isActive" = true
    ORDER BY "isDefaultInGroup" DESC, "name" ASC
  `;
}
