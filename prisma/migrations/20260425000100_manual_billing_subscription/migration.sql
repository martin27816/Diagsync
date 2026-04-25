-- Extend billing enums and organization billing fields
ALTER TYPE "OrganizationStatus" ADD VALUE IF NOT EXISTS 'TRIAL_ACTIVE';
ALTER TYPE "OrganizationStatus" ADD VALUE IF NOT EXISTS 'TRIAL_EXPIRED';
ALTER TYPE "OrganizationStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "OrganizationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "OrganizationPlan_new" AS ENUM ('TRIAL', 'STARTER', 'ADVANCED');

ALTER TABLE "organizations"
  ALTER COLUMN "plan" DROP DEFAULT;

ALTER TABLE "organizations"
  ALTER COLUMN "plan" TYPE "OrganizationPlan_new"
  USING (
    CASE
      WHEN "plan"::text = 'ENTERPRISE' THEN 'ADVANCED'::"OrganizationPlan_new"
      WHEN "plan"::text = 'STARTER' THEN 'STARTER'::"OrganizationPlan_new"
      ELSE 'TRIAL'::"OrganizationPlan_new"
    END
  );

DROP TYPE "OrganizationPlan";
ALTER TYPE "OrganizationPlan_new" RENAME TO "OrganizationPlan";

ALTER TABLE "organizations"
  ADD COLUMN "trialStartedAt" TIMESTAMP(3),
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "subscriptionStartedAt" TIMESTAMP(3),
  ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3),
  ADD COLUMN "lastPaymentAt" TIMESTAMP(3),
  ADD COLUMN "watermarkEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "staffLimit" INTEGER,
  ADD COLUMN "billingLockedAt" TIMESTAMP(3),
  ADD COLUMN "billingLockReason" TEXT;

ALTER TABLE "organizations"
  ALTER COLUMN "plan" SET DEFAULT 'TRIAL';

UPDATE "organizations"
SET
  "watermarkEnabled" = CASE WHEN "plan" = 'ADVANCED' THEN false ELSE true END,
  "staffLimit" = CASE WHEN "plan" = 'STARTER' THEN 15 ELSE NULL END
WHERE "staffLimit" IS NULL;

CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "subscription_payment_requests" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestedPlan" "OrganizationPlan" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "bankName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "transactionReference" TEXT,
  "proofUrl" TEXT,
  "notes" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "subscription_payment_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscription_payment_requests_organizationId_status_createdAt_idx"
  ON "subscription_payment_requests"("organizationId", "status", "createdAt");

CREATE INDEX "subscription_payment_requests_reviewedById_idx"
  ON "subscription_payment_requests"("reviewedById");

ALTER TABLE "subscription_payment_requests"
  ADD CONSTRAINT "subscription_payment_requests_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_payment_requests"
  ADD CONSTRAINT "subscription_payment_requests_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
