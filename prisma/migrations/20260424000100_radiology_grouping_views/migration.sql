-- Additive support for grouped radiology views
ALTER TABLE "diagnostic_tests"
  ADD COLUMN "groupKey" TEXT,
  ADD COLUMN "viewType" TEXT,
  ADD COLUMN "isDefaultInGroup" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "diagnostic_tests_organizationId_groupKey_idx"
  ON "diagnostic_tests"("organizationId", "groupKey");
