import { LOCKED_PROFILE_FIELDS, errors } from "@gistroom/shared";
import { AppError } from "../http";

/**
 * Email and username are permanent. A request body that names either one is refused with a 400 that points at the
 * field, so a crafted request or a stale form can never believe it changed them. Checked before anything is saved.
 */
export function rejectLockedFields(raw: unknown): void {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const named = LOCKED_PROFILE_FIELDS.filter((key) =>
    Object.prototype.hasOwnProperty.call(raw, key),
  );
  if (named.length === 0) return;
  throw new AppError(400, "INVALID", errors.identityLocked, {
    fields: Object.fromEntries(named.map((key) => [key, errors.identityLocked])),
  });
}
