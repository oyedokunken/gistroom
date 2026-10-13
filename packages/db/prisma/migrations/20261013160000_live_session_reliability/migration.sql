-- AlterTable
ALTER TABLE "Call" ADD COLUMN "callerSeenAt" TIMESTAMP(3),
ADD COLUMN "calleeSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "longWarnedAt" TIMESTAMP(3),
ADD COLUMN "emptySince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RoomMember" ADD COLUMN "heartbeatAt" TIMESTAMP(3),
ADD COLUMN "ringStatus" TEXT,
ADD COLUMN "ringedAt" TIMESTAMP(3),
ADD COLUMN "noRing" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LiveKitEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveKitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveKitEvent_createdAt_idx" ON "LiveKitEvent"("createdAt");
