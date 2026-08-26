-- DropForeignKey
ALTER TABLE "WfhRequest" DROP CONSTRAINT "WfhRequest_projectId_fkey";

-- DropIndex
DROP INDEX "WfhRequest_projectId_idx";

-- AlterTable
ALTER TABLE "WfhRequest" DROP COLUMN "projectId";
