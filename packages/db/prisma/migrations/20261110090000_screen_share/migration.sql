-- Screen sharing: one presenter per call or room, and the stop action in the moderator log.
ALTER TYPE "RoomModAction" ADD VALUE 'PRESENT_STOP';

ALTER TABLE "Call"
  ADD COLUMN "presenterId" TEXT,
  ADD COLUMN "presentRequesterId" TEXT,
  ADD COLUMN "presentRequestedAt" TIMESTAMP(3),
  ADD COLUMN "presentHandoffAt" TIMESTAMP(3);

ALTER TABLE "Room"
  ADD COLUMN "presenterId" TEXT,
  ADD COLUMN "presentRequesterId" TEXT,
  ADD COLUMN "presentRequestedAt" TIMESTAMP(3),
  ADD COLUMN "presentHandoffAt" TIMESTAMP(3);
