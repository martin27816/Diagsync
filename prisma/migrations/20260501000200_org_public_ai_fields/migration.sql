ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "aiConfidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "aiSource" TEXT,
  ADD COLUMN IF NOT EXISTS "lastFetchedAt" TIMESTAMP(3);

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "slug" TEXT;

UPDATE "organizations"
SET "slug" = COALESCE(NULLIF("slug", ''), "id")
WHERE "slug" IS NULL OR "slug" = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'organizations_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
  END IF;
END $$;

ALTER TABLE "organizations"
  ALTER COLUMN "slug" SET NOT NULL;
