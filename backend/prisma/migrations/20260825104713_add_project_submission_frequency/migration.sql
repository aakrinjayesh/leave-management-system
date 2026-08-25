-- CreateEnum
CREATE TYPE "SubmissionFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "submissionFrequency" "SubmissionFrequency" NOT NULL DEFAULT 'WEEKLY';
