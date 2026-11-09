-- Page and search a person's notifications in the order they are shown.
CREATE INDEX "Notification_userId_createdAt_id_idx" ON "Notification"("userId", "createdAt" DESC, "id" DESC);

-- One decision per person, per inactivity spell, per channel for the come back nudge.
CREATE TABLE "ReengagementNotice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReengagementNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReengagementNotice_userId_windowStart_channel_key" ON "ReengagementNotice"("userId", "windowStart", "channel");
CREATE INDEX "ReengagementNotice_userId_createdAt_idx" ON "ReengagementNotice"("userId", "createdAt");

ALTER TABLE "ReengagementNotice" ADD CONSTRAINT "ReengagementNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
