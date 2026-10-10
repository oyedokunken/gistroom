/**
 * Google sign in is fully built and switched off until GOOGLE_AUTH_ENABLED is "true".
 * Read straight from the environment so a missing secret elsewhere cannot hide the answer.
 */
export function isGoogleEnabled(source: NodeJS.ProcessEnv = process.env): boolean {
  return source.GOOGLE_AUTH_ENABLED === "true";
}

/** The response while the flag is off: it looks like the route does not exist and nothing starts. */
export function googleOffResponse(): Response {
  return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
}
