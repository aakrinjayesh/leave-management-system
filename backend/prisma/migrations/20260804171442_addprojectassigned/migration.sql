-- CreateEnum
CREATE TYPE "ProjectAssignmentStatus" AS ENUM ('ASSIGNED', 'NOT_ASSIGNED');

-- AlterTable
ALTER TABLE "TimesheetSubmission" ADD COLUMN     "projectAssigned" "ProjectAssignmentStatus";
