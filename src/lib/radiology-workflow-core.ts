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
  return (
    params.userRole === "RADIOGRAPHER" &&
    Boolean(params.assignedStaffId) &&
    params.userId === params.assignedStaffId
  );
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
}) {
  return Boolean(report.findings?.trim()) && Boolean(report.impression?.trim());
}

