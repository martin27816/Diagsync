-- Phase 5: Flexible reference ranges for result template fields
ALTER TABLE "result_template_fields"
  ADD COLUMN IF NOT EXISTS "normalText" TEXT,
  ADD COLUMN IF NOT EXISTS "referenceNote" TEXT;
