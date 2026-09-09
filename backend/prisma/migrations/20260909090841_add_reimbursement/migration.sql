-- CreateTable
CREATE TABLE "Reimbursement" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "routedToId" INTEGER,
    "approvedById" INTEGER,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "managerRemarks" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByManager" BOOLEAN NOT NULL DEFAULT false,
    "createdByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reimbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementAttachment" (
    "id" SERIAL NOT NULL,
    "reimbursementId" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReimbursementAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reimbursement_userId_idx" ON "Reimbursement"("userId");

-- CreateIndex
CREATE INDEX "Reimbursement_routedToId_idx" ON "Reimbursement"("routedToId");

-- CreateIndex
CREATE INDEX "Reimbursement_approvedById_idx" ON "Reimbursement"("approvedById");

-- CreateIndex
CREATE INDEX "Reimbursement_status_idx" ON "Reimbursement"("status");

-- CreateIndex
CREATE INDEX "ReimbursementAttachment_reimbursementId_idx" ON "ReimbursementAttachment"("reimbursementId");

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_routedToId_fkey" FOREIGN KEY ("routedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementAttachment" ADD CONSTRAINT "ReimbursementAttachment_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "Reimbursement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
