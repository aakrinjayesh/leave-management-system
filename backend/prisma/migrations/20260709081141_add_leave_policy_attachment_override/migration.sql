-- AlterTable
ALTER TABLE "LeavePolicy" ADD COLUMN     "attachmentRequiredAboveDays" INTEGER,
ADD COLUMN     "maxLeavesPerRequestWithAttachment" INTEGER;
