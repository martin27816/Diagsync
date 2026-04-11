import { prisma } from "@/lib/prisma";

export async function getVersionHistory(input: {
  entityType: "LAB_RESULT" | "RADIOLOGY_REPORT";
  entityId: string;
}) {
  if (input.entityType === "LAB_RESULT") {
    return prisma.labResultVersion.findMany({
      where: { labResultId: input.entityId },
      include: { editedBy: { select: { id: true, fullName: true } } },
      orderBy: { version: "desc" },
    });
  }

  return prisma.radiologyReportVersion.findMany({
    where: { reportId: input.entityId },
    include: { editedBy: { select: { id: true, fullName: true } } },
    orderBy: { version: "desc" },
  });
}
