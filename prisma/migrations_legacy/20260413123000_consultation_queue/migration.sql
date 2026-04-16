-- Consultation queue workflow for receptionist and MD
CREATE TYPE "ConsultationStatus" AS ENUM ('WAITING', 'CALLED', 'CONSULTED', 'CANCELLED');

CREATE TABLE "consultation_queue" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "age" INTEGER NOT NULL,
  "contact" TEXT NOT NULL,
  "vitalsNote" TEXT,
  "status" "ConsultationStatus" NOT NULL DEFAULT 'WAITING',
  "arrivalAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "calledAt" TIMESTAMP(3),
  "calledById" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" TEXT,
  "consultedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "consultation_queue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consultation_queue_organizationId_status_arrivalAt_idx" ON "consultation_queue"("organizationId", "status", "arrivalAt");
CREATE INDEX "consultation_queue_organizationId_consultedAt_idx" ON "consultation_queue"("organizationId", "consultedAt");

ALTER TABLE "consultation_queue" ADD CONSTRAINT "consultation_queue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultation_queue" ADD CONSTRAINT "consultation_queue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultation_queue" ADD CONSTRAINT "consultation_queue_calledById_fkey" FOREIGN KEY ("calledById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consultation_queue" ADD CONSTRAINT "consultation_queue_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
