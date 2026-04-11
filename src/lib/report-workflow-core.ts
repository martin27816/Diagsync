import { Department, ReportStatus, ReportType } from "@prisma/client";

export function isReportDepartment(department: Department) {
  return department === Department.LABORATORY || department === Department.RADIOLOGY;
}

export function canManageLabSettings(role: string) {
  return role === "SUPER_ADMIN";
}

export function canMdEditReport(role: string) {
  return role === "MD" || role === "SUPER_ADMIN";
}

export function canHrmReleaseReport(role: string) {
  return role === "HRM" || role === "SUPER_ADMIN";
}

export function canPreviewReport(role: string) {
  return role === "MD" || role === "HRM" || role === "SUPER_ADMIN" || role === "RECEPTIONIST";
}

export function canDispatchReleasedReport(role: string) {
  return role === "HRM" || role === "SUPER_ADMIN" || role === "RECEPTIONIST";
}

export function canRelease(reportStatus: ReportStatus, isReleased: boolean) {
  return reportStatus === ReportStatus.DRAFT && !isReleased;
}

export function hasValidReportContent(content: unknown) {
  return Boolean(content && typeof content === "object");
}

export function getReportLabel(department: Department) {
  return department === Department.LABORATORY ? "Lab Report" : "Radiology Report";
}

export function reportTypeForDepartment(department: Department): ReportType {
  return department === Department.LABORATORY ? "lab" : "radiology";
}

export function assertReportTypeMatchesDepartment(reportType: ReportType, department: Department) {
  const expected = reportTypeForDepartment(department);
  if (reportType !== expected) {
    throw new Error("REPORT_TYPE_MISMATCH");
  }
}
