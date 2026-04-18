-- Add MEGA_ADMIN role support
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MEGA_ADMIN';

-- Add organization plan and status enums
DO $$
BEGIN
  CREATE TYPE "OrganizationPlan" AS ENUM ('STARTER', 'ENTERPRISE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Extend organizations for platform-level administration
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "plan" "OrganizationPlan" NOT NULL DEFAULT 'STARTER',
  ADD COLUMN IF NOT EXISTS "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE';

-- Allow platform admins without tenant ownership
ALTER TABLE "staff"
  ALTER COLUMN "organizationId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "lastSeen" TIMESTAMP(3);
