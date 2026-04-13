-- Add persistent custom fields support for radiology draft/report editing
ALTER TABLE "radiology_reports"
ADD COLUMN IF NOT EXISTS "extra_fields" JSONB;

ALTER TABLE "radiology_report_versions"
ADD COLUMN IF NOT EXISTS "extra_fields" JSONB;
