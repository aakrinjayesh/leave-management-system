-- CreateEnum
CREATE TYPE "ProjectTimezone" AS ENUM ('IST', 'US_EASTERN', 'US_PACIFIC', 'DUBAI', 'UK', 'SINGAPORE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "projectType" "ProjectAssignmentStatus" NOT NULL DEFAULT 'NOT_ASSIGNED',
ADD COLUMN     "timezone" "ProjectTimezone" NOT NULL DEFAULT 'IST',
ADD COLUMN     "workEndTime" TEXT NOT NULL DEFAULT '18:00',
ADD COLUMN     "workStartTime" TEXT NOT NULL DEFAULT '09:00';
