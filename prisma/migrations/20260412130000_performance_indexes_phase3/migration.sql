-- Phase 3 performance indexes (additive, no destructive changes)
CREATE INDEX IF NOT EXISTS "routing_tasks_org_dept_staff_status_createdAt_idx"
  ON "routing_tasks" ("organizationId", "department", "staffId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "routing_tasks_org_dept_staff_createdAt_idx"
  ON "routing_tasks" ("organizationId", "department", "staffId", "createdAt");

CREATE INDEX IF NOT EXISTS "diagnostic_reports_org_isReleased_updatedAt_idx"
  ON "diagnostic_reports" ("organizationId", "isReleased", "updatedAt");
