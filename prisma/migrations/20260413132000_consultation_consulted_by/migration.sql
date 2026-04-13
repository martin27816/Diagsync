ALTER TABLE "consultation_queue"
  ADD COLUMN IF NOT EXISTS "consultedById" TEXT;

ALTER TABLE "consultation_queue"
  ADD CONSTRAINT "consultation_queue_consultedById_fkey"
  FOREIGN KEY ("consultedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
