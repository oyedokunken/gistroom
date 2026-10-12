import { cleanupE2e, dbAvailable } from "./auth-helpers";

export default async function globalTeardown() {
  if (!dbAvailable) return;
  await cleanupE2e();
}
