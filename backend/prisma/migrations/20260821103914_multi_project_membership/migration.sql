-- CreateTable
CREATE TABLE "ProjectMembership" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMembership_userId_idx" ON "ProjectMembership"("userId");

-- CreateIndex
CREATE INDEX "ProjectMembership_projectId_idx" ON "ProjectMembership"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMembership_userId_projectId_key" ON "ProjectMembership"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: preserve every existing single-project assignment as a real
-- ProjectMembership row before the old column is dropped below, instead of
-- silently losing it.
INSERT INTO "ProjectMembership" ("userId", "projectId", "assignedAt")
SELECT "id", "assignedProjectId", CURRENT_TIMESTAMP
FROM "User"
WHERE "assignedProjectId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_assignedProjectId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "assignedProjectId";

-- DropIndex
DROP INDEX "TimesheetEntry_userId_date_key";

-- AlterTable
ALTER TABLE "TimesheetEntry" ADD COLUMN     "projectId" INTEGER;

-- CreateIndex
CREATE INDEX "TimesheetEntry_projectId_idx" ON "TimesheetEntry"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetEntry_userId_date_projectId_key" ON "TimesheetEntry"("userId", "date", "projectId");

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "TimesheetSubmission_userId_weekStartDate_key";

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetSubmission_userId_weekStartDate_projectId_key" ON "TimesheetSubmission"("userId", "weekStartDate", "projectId");

-- DataMigration: existing entries already inherit their submission's
-- projectId, so anyone whose weekly submission was already tied to a
-- project keeps that association on each of its individual daily entries too.
UPDATE "TimesheetEntry" te
SET "projectId" = ts."projectId"
FROM "TimesheetSubmission" ts
WHERE te."timesheetSubmissionId" = ts."id"
  AND ts."projectId" IS NOT NULL;
