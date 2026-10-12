import { dbAvailable, prepareDb } from "./auth-helpers";

/** Signed in specs need the topics and a clean slate of earlier e2e people. */
export default async function globalSetup() {
  if (!dbAvailable) return;
  await prepareDb();
}
