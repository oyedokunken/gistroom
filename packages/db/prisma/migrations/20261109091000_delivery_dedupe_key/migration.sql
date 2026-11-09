-- AlterTable
ALTER TABLE "NotificationDelivery" ADD COLUMN "dedupeKey" TEXT;

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_dedupeKey_idx" ON "NotificationDelivery"("userId", "dedupeKey");
