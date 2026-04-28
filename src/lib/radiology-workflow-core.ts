import { RoutingTaskStatus } from "@prisma/client";

export const ALLOWED_IMAGING_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/dicom",
  "application/dicom+json",
  "application/pdf",
]);

export const MAX_IMAGING_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export function canModifyRadiologyTask(params: {
  userRole: string;
  userId: string;
  assignedStaffId: string | null;
}) {
  return params.userRole === "RADIOGRAPHER";
}

export function canStartRadiologyTask(status: RoutingTaskStatus) {
  return status === RoutingTaskStatus.PENDING || status === RoutingTaskStatus.IN_PROGRESS;
}

export function canSubmitRadiologyTask(status: RoutingTaskStatus) {
  return status !== RoutingTaskStatus.COMPLETED && status !== RoutingTaskStatus.CANCELLED;
}

export function isValidImagingFile(params: { mimeType: string; sizeBytes: number }) {
  if (!ALLOWED_IMAGING_MIME.has(params.mimeType)) return false;
  if (params.sizeBytes <= 0 || params.sizeBytes > MAX_IMAGING_SIZE_BYTES) return false;
  return true;
}

export function hasRequiredReportFields(report: {
  findings?: string | null;
  impression?: string | null;
  extraFields?: Record<string, string> | null;
}, testOrderIds?: string[]) {
  const hasTopLevel = Boolean(report.findings?.trim()) && Boolean(report.impression?.trim());
  if (!testOrderIds || testOrderIds.length === 0) return hasTopLevel;

  try {
    const raw = report.extraFields?.["__perTestReports"];
    if (!raw) return hasTopLevel;
    const parsed = JSON.parse(raw) as Array<{ testOrderId?: string; findings?: string; impression?: string }>;
    const map = new Map(
      (Array.isArray(parsed) ? parsed : [])
        .filter((row) => row && typeof row === "object" && typeof row.testOrderId === "string")
        .map((row) => [row.testOrderId as string, row])
    );
    return testOrderIds.every((id) => {
      const row = map.get(id);
      return Boolean(row?.findings?.trim()) && Boolean(row?.impression?.trim());
    });
  } catch {
    return hasTopLevel;
  }
}
