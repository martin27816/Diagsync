ALTER TABLE "staff"
ADD COLUMN IF NOT EXISTS "pinHash" TEXT,
ADD COLUMN IF NOT EXISTS "pinSetAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastQuickSwitchAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "devices" (
  "id" TEXT NOT NULL,
  "deviceKey" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "device_staff" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "device_staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "devices_deviceKey_key" ON "devices"("deviceKey");
CREATE INDEX IF NOT EXISTS "devices_organizationId_idx" ON "devices"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "device_staff_deviceId_staffId_key" ON "device_staff"("deviceId", "staffId");
CREATE INDEX IF NOT EXISTS "device_staff_staffId_idx" ON "device_staff"("staffId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'devices_organizationId_fkey'
  ) THEN
    ALTER TABLE "devices"
      ADD CONSTRAINT "devices_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_staff_deviceId_fkey'
  ) THEN
    ALTER TABLE "device_staff"
      ADD CONSTRAINT "device_staff_deviceId_fkey"
      FOREIGN KEY ("deviceId") REFERENCES "devices"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_staff_staffId_fkey'
  ) THEN
    ALTER TABLE "device_staff"
      ADD CONSTRAINT "device_staff_staffId_fkey"
      FOREIGN KEY ("staffId") REFERENCES "staff"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
