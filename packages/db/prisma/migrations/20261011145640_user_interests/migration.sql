-- CreateTable
CREATE TABLE "UserInterest" (
    "userId" TEXT NOT NULL,
    "topicSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInterest_pkey" PRIMARY KEY ("userId","topicSlug")
);

-- CreateIndex
CREATE INDEX "UserInterest_topicSlug_idx" ON "UserInterest"("topicSlug");

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
