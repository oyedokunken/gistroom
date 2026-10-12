-- AlterTable
ALTER TABLE "Session" ADD COLUMN "deviceId" TEXT,
ADD COLUMN "authenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "endReason" TEXT,
ADD COLUMN "endedAt" TIMESTAMP(3);

-- Sessions that were already revoked before this change get a reason so the diagnostics are never blank.
UPDATE "Session" SET "endedAt" = "revokedAt", "endReason" = 'REVOKED_BY_USER' WHERE "revokedAt" IS NOT NULL AND "endedAt" IS NULL;

-- AlterTable
ALTER TABLE "PushSubscription" ADD COLUMN "deviceId" TEXT,
ADD COLUMN "deviceLabel" TEXT,
ADD COLUMN "needsReauth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unhealthyAt" TIMESTAMP(3),
ADD COLUMN "unhealthySeenAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Session_deviceId_idx" ON "Session"("deviceId");

-- CreateIndex
CREATE INDEX "Session_endedAt_idx" ON "Session"("endedAt");

-- CreateIndex
CREATE INDEX "PushSubscription_deviceId_idx" ON "PushSubscription"("deviceId");
