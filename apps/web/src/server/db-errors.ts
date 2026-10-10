/** True for a Prisma unique constraint failure (P2002), optionally on a named field. */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== "P2002") return false;
  if (!field) return true;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.some((t) => String(t).includes(field));
  // The pg driver adapter reports the constraint name or fields in different shapes.
  if (typeof target === "string") return target.includes(field);
  return true;
}
