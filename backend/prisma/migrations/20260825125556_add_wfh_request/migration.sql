-- CreateTable
CREATE TABLE "WfhRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "adminRemarks" TEXT,
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WfhRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WfhRequest_userId_idx" ON "WfhRequest"("userId");

-- CreateIndex
CREATE INDEX "WfhRequest_projectId_idx" ON "WfhRequest"("projectId");

-- CreateIndex
CREATE INDEX "WfhRequest_status_idx" ON "WfhRequest"("status");

-- AddForeignKey
ALTER TABLE "WfhRequest" ADD CONSTRAINT "WfhRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfhRequest" ADD CONSTRAINT "WfhRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfhRequest" ADD CONSTRAINT "WfhRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
