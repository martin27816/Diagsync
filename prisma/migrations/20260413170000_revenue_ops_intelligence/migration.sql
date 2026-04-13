-- Revenue + Ops intelligence schema extension
CREATE TYPE "VisitStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "PaymentEntryType" AS ENUM ('PAYMENT', 'REFUND', 'ADJUSTMENT');

ALTER TABLE "diagnostic_tests"
  ADD COLUMN "costPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "visits"
  ADD COLUMN "status" "VisitStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledReason" TEXT,
  ADD COLUMN "noShowAt" TIMESTAMP(3),
  ADD COLUMN "noShowReason" TEXT;

ALTER TABLE "test_orders"
  ADD COLUMN "priceOverriddenById" TEXT,
  ADD COLUMN "defaultPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "priceOverrideReason" TEXT;

UPDATE "test_orders"
SET "defaultPrice" = "price"
WHERE "defaultPrice" = 0;

CREATE TABLE "visit_payments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "recordedById" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "paymentType" "PaymentEntryType" NOT NULL DEFAULT 'PAYMENT',
  "paymentMethod" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visit_payments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "test_orders"
  ADD CONSTRAINT "test_orders_priceOverriddenById_fkey"
    FOREIGN KEY ("priceOverriddenById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "visit_payments"
  ADD CONSTRAINT "visit_payments_visitId_fkey"
    FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visit_payments"
  ADD CONSTRAINT "visit_payments_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "visits_organizationId_status_registeredAt_idx"
  ON "visits"("organizationId", "status", "registeredAt");

CREATE INDEX "test_orders_organizationId_priceOverriddenById_createdAt_idx"
  ON "test_orders"("organizationId", "priceOverriddenById", "createdAt");

CREATE INDEX "visit_payments_organizationId_visitId_createdAt_idx"
  ON "visit_payments"("organizationId", "visitId", "createdAt");

CREATE INDEX "visit_payments_organizationId_paymentType_createdAt_idx"
  ON "visit_payments"("organizationId", "paymentType", "createdAt");
