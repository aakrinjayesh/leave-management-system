-- AlterTable
ALTER TABLE "TimesheetSubmission" ADD COLUMN "createdByManager" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TimesheetSubmission" ADD COLUMN "createdByAdmin" BOOLEAN NOT NULL DEFAULT false;
