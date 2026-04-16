-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'RECEPTIONIST', 'LAB_SCIENTIST', 'RADIOGRAPHER', 'MD', 'HRM');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('RECEPTION', 'LABORATORY', 'RADIOLOGY', 'MEDICAL_REVIEW', 'HR_OPERATIONS');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT', 'FULL_DAY');

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('LAB', 'RADIOLOGY');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('NUMBER', 'TEXT', 'TEXTAREA', 'DROPDOWN', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentEntryType" AS ENUM ('PAYMENT', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('REGISTERED', 'ASSIGNED', 'OPENED', 'SAMPLE_PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_DRAFTED', 'SUBMITTED_FOR_REVIEW', 'EDIT_REQUESTED', 'RESUBMITTED', 'APPROVED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoutingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('PENDING', 'COLLECTED', 'RECEIVED', 'PROCESSING', 'DONE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'RESULT_SUBMITTED', 'RESULT_APPROVED', 'RESULT_REJECTED', 'RESULT_EDITED', 'REPORT_DRAFT_UPDATED', 'REPORT_READY_FOR_REVIEW', 'REPORT_RELEASED', 'REPORT_SENT', 'REPORT_PRINTED', 'REPORT_DOWNLOADED', 'REPORT_SEND_FAILED', 'TASK_DELAYED', 'TASK_REASSIGNED', 'TASK_OVERRIDDEN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'RELEASED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('lab', 'radiology');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('WAITING', 'CALLED', 'CONSULTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "logo" TEXT,
    "contactInfo" TEXT,
    "letterheadUrl" TEXT,
    "consultationTimeoutMinutes" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "department" "Department" NOT NULL,
    "gender" TEXT,
    "dateJoined" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defaultShift" "Shift" NOT NULL DEFAULT 'MORNING',
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'UNAVAILABLE',
    "lastAvailableAt" TIMESTAMP(3),
    "lastUnavailableAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "consultedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_logs" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "oldStatus" "AvailabilityStatus" NOT NULL,
    "newStatus" "AvailabilityStatus" NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB,
    "oldValue" JSONB,
    "newValue" JSONB,
    "notes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_tests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "TestType" NOT NULL,
    "department" "Department" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "turnaroundMinutes" INTEGER NOT NULL,
    "sampleType" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_template_fields" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldType" "FieldType" NOT NULL,
    "unit" TEXT,
    "normalMin" DECIMAL(10,3),
    "normalMax" DECIMAL(10,3),
    "normalText" TEXT,
    "referenceNote" TEXT,
    "options" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" "Sex" NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "referringDoctor" TEXT,
    "clinicalNote" TEXT,
    "registeredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "visitNumber" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'ROUTINE',
    "status" "VisitStatus" NOT NULL DEFAULT 'ACTIVE',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "noShowAt" TIMESTAMP(3),
    "noShowReason" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_orders" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "priceOverriddenById" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'REGISTERED',
    "defaultPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL,
    "priceOverrideReason" TEXT,
    "notes" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "sampleCollectedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "routing_tasks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "staffId" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'ROUTINE',
    "status" "RoutingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "testOrderIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routing_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_samples" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "status" "SampleStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "collectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "testOrderId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,
    "notes" TEXT,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imaging_files" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imaging_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "impression" TEXT NOT NULL,
    "notes" TEXT,
    "extraFields" JSONB,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radiology_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "visitId" TEXT,
    "reviewedById" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "editedData" JSONB,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "entityId" TEXT,
    "entityType" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "reportType" "ReportType" NOT NULL DEFAULT 'lab',
    "sourceTaskId" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "reportContent" JSONB NOT NULL,
    "comments" TEXT,
    "prescription" TEXT,
    "previewFileUrl" TEXT,
    "finalFileUrl" TEXT,
    "generatedById" TEXT,
    "lastEditedById" TEXT,
    "lastEditedAt" TIMESTAMP(3),
    "isReleased" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "releaseInstructions" TEXT,
    "lastActionAt" TIMESTAMP(3),
    "publicShareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_report_versions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "comments" TEXT,
    "prescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "editedById" TEXT NOT NULL,
    "editReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_result_versions" (
    "id" TEXT NOT NULL,
    "labResultId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "resultData" JSONB NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "editedById" TEXT NOT NULL,
    "editReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_result_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_report_versions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "findings" TEXT NOT NULL,
    "impression" TEXT NOT NULL,
    "notes" TEXT,
    "extraFields" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "editedById" TEXT NOT NULL,
    "editReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radiology_report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_email_key" ON "organizations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE INDEX "consultation_queue_organizationId_status_arrivalAt_idx" ON "consultation_queue"("organizationId", "status", "arrivalAt");

-- CreateIndex
CREATE INDEX "consultation_queue_organizationId_consultedAt_idx" ON "consultation_queue"("organizationId", "consultedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_createdAt_idx" ON "audit_logs"("entityType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_tests_organizationId_code_key" ON "diagnostic_tests"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "patients_organizationId_patientId_key" ON "patients"("organizationId", "patientId");

-- CreateIndex
CREATE INDEX "visits_organizationId_status_registeredAt_idx" ON "visits"("organizationId", "status", "registeredAt");

-- CreateIndex
CREATE INDEX "test_orders_organizationId_assignedToId_status_idx" ON "test_orders"("organizationId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "test_orders_organizationId_priceOverriddenById_createdAt_idx" ON "test_orders"("organizationId", "priceOverriddenById", "createdAt");

-- CreateIndex
CREATE INDEX "visit_payments_organizationId_visitId_createdAt_idx" ON "visit_payments"("organizationId", "visitId", "createdAt");

-- CreateIndex
CREATE INDEX "visit_payments_organizationId_paymentType_createdAt_idx" ON "visit_payments"("organizationId", "paymentType", "createdAt");

-- CreateIndex
CREATE INDEX "routing_tasks_organizationId_department_status_priority_idx" ON "routing_tasks"("organizationId", "department", "status", "priority");

-- CreateIndex
CREATE INDEX "routing_tasks_organizationId_department_staffId_status_crea_idx" ON "routing_tasks"("organizationId", "department", "staffId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "routing_tasks_organizationId_department_staffId_createdAt_idx" ON "routing_tasks"("organizationId", "department", "staffId", "createdAt");

-- CreateIndex
CREATE INDEX "routing_tasks_visitId_department_idx" ON "routing_tasks"("visitId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "lab_samples_taskId_key" ON "lab_samples"("taskId");

-- CreateIndex
CREATE INDEX "lab_samples_organizationId_staffId_status_idx" ON "lab_samples"("organizationId", "staffId", "status");

-- CreateIndex
CREATE INDEX "lab_results_organizationId_staffId_isSubmitted_idx" ON "lab_results"("organizationId", "staffId", "isSubmitted");

-- CreateIndex
CREATE UNIQUE INDEX "lab_results_taskId_testOrderId_key" ON "lab_results"("taskId", "testOrderId");

-- CreateIndex
CREATE INDEX "imaging_files_organizationId_taskId_idx" ON "imaging_files"("organizationId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "radiology_reports_taskId_key" ON "radiology_reports"("taskId");

-- CreateIndex
CREATE INDEX "radiology_reports_organizationId_staffId_isSubmitted_idx" ON "radiology_reports"("organizationId", "staffId", "isSubmitted");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_taskId_key" ON "reviews"("taskId");

-- CreateIndex
CREATE INDEX "reviews_organizationId_status_updatedAt_idx" ON "reviews"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "reviews_visitId_idx" ON "reviews"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "notifications_organizationId_userId_createdAt_idx" ON "notifications"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_organizationId_type_createdAt_idx" ON "notifications"("organizationId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_organizationId_userId_updatedAt_idx" ON "push_subscriptions"("organizationId", "userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_reports_publicShareToken_key" ON "diagnostic_reports"("publicShareToken");

-- CreateIndex
CREATE INDEX "diagnostic_reports_organizationId_department_status_updated_idx" ON "diagnostic_reports"("organizationId", "department", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "diagnostic_reports_organizationId_reportType_status_updated_idx" ON "diagnostic_reports"("organizationId", "reportType", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "diagnostic_reports_organizationId_isReleased_updatedAt_idx" ON "diagnostic_reports"("organizationId", "isReleased", "updatedAt");

-- CreateIndex
CREATE INDEX "diagnostic_reports_sourceTaskId_idx" ON "diagnostic_reports"("sourceTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_reports_visitId_department_key" ON "diagnostic_reports"("visitId", "department");

-- CreateIndex
CREATE INDEX "diagnostic_report_versions_reportId_isActive_idx" ON "diagnostic_report_versions"("reportId", "isActive");

-- CreateIndex
CREATE INDEX "diagnostic_report_versions_parentId_idx" ON "diagnostic_report_versions"("parentId");

-- CreateIndex
CREATE INDEX "diagnostic_report_versions_editedById_createdAt_idx" ON "diagnostic_report_versions"("editedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_report_versions_reportId_version_key" ON "diagnostic_report_versions"("reportId", "version");

-- CreateIndex
CREATE INDEX "lab_result_versions_labResultId_isActive_idx" ON "lab_result_versions"("labResultId", "isActive");

-- CreateIndex
CREATE INDEX "lab_result_versions_parentId_idx" ON "lab_result_versions"("parentId");

-- CreateIndex
CREATE INDEX "lab_result_versions_createdAt_idx" ON "lab_result_versions"("createdAt");

-- CreateIndex
CREATE INDEX "lab_result_versions_editedById_createdAt_idx" ON "lab_result_versions"("editedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "lab_result_versions_labResultId_version_key" ON "lab_result_versions"("labResultId", "version");

-- CreateIndex
CREATE INDEX "radiology_report_versions_reportId_isActive_idx" ON "radiology_report_versions"("reportId", "isActive");

-- CreateIndex
CREATE INDEX "radiology_report_versions_parentId_idx" ON "radiology_report_versions"("parentId");

-- CreateIndex
CREATE INDEX "radiology_report_versions_createdAt_idx" ON "radiology_report_versions"("createdAt");

-- CreateIndex
CREATE INDEX "radiology_report_versions_editedById_createdAt_idx" ON "radiology_report_versions"("editedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "radiology_report_versions_reportId_version_key" ON "radiology_report_versions"("reportId", "version");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_queue" ADD CONSTRAINT "consultation_queue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_queue" ADD CONSTRAINT "consultation_queue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_queue" ADD CONSTRAINT "consultation_queue_calledById_fkey" FOREIGN KEY ("calledById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_queue" ADD CONSTRAINT "consultation_queue_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_queue" ADD CONSTRAINT "consultation_queue_consultedById_fkey" FOREIGN KEY ("consultedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_logs" ADD CONSTRAINT "availability_logs_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_tests" ADD CONSTRAINT "diagnostic_tests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_tests" ADD CONSTRAINT "diagnostic_tests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "test_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_template_fields" ADD CONSTRAINT "result_template_fields_testId_fkey" FOREIGN KEY ("testId") REFERENCES "diagnostic_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_orders" ADD CONSTRAINT "test_orders_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_orders" ADD CONSTRAINT "test_orders_testId_fkey" FOREIGN KEY ("testId") REFERENCES "diagnostic_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_orders" ADD CONSTRAINT "test_orders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_orders" ADD CONSTRAINT "test_orders_priceOverriddenById_fkey" FOREIGN KEY ("priceOverriddenById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_payments" ADD CONSTRAINT "visit_payments_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_payments" ADD CONSTRAINT "visit_payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_tasks" ADD CONSTRAINT "routing_tasks_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_tasks" ADD CONSTRAINT "routing_tasks_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_samples" ADD CONSTRAINT "lab_samples_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "routing_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_samples" ADD CONSTRAINT "lab_samples_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_samples" ADD CONSTRAINT "lab_samples_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "routing_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_testOrderId_fkey" FOREIGN KEY ("testOrderId") REFERENCES "test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_files" ADD CONSTRAINT "imaging_files_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "routing_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_files" ADD CONSTRAINT "imaging_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_reports" ADD CONSTRAINT "radiology_reports_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "routing_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_reports" ADD CONSTRAINT "radiology_reports_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "routing_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_report_versions" ADD CONSTRAINT "diagnostic_report_versions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "diagnostic_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_report_versions" ADD CONSTRAINT "diagnostic_report_versions_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_report_versions" ADD CONSTRAINT "diagnostic_report_versions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "diagnostic_report_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_versions" ADD CONSTRAINT "lab_result_versions_labResultId_fkey" FOREIGN KEY ("labResultId") REFERENCES "lab_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_versions" ADD CONSTRAINT "lab_result_versions_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_versions" ADD CONSTRAINT "lab_result_versions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "lab_result_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_report_versions" ADD CONSTRAINT "radiology_report_versions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "radiology_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_report_versions" ADD CONSTRAINT "radiology_report_versions_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_report_versions" ADD CONSTRAINT "radiology_report_versions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "radiology_report_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

