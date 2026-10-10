import { getDb } from "@gistroom/db";
import { errors, onboardingSchema } from "@gistroom/shared";
import { api, conflict, json, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { isUniqueViolation } from "@/server/db-errors";
import { toMe } from "@/server/users/serialize";

export const POST = api(async (request) => {
  const { user } = await requireUser();
  if (user.onboardedAt) throw conflict(errors.alreadyOnboarded);
  const input = await parseJson(request, onboardingSchema);
  const now = new Date();
  try {
    const updated = await getDb().user.update({
      where: { id: user.id },
      data: {
        name: input.name,
        username: input.username,
        ageConfirmedAt: now,
        termsAcceptedAt: now,
        onboardedAt: now,
      },
    });
    return json({ user: toMe(updated) });
  } catch (error) {
    if (isUniqueViolation(error, "username")) {
      throw conflict(errors.usernameTaken, { username: errors.usernameTaken });
    }
    throw error;
  }
});
