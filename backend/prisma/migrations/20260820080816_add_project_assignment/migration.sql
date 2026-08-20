-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assignedProjectId" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedProjectId_fkey" FOREIGN KEY ("assignedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
