-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "routedToId" INTEGER;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "LeaveRequest_routedToId_idx" ON "LeaveRequest"("routedToId");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_routedToId_fkey" FOREIGN KEY ("routedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
