import { z } from "zod";

/** Parses env with a readable failure. Set SKIP_ENV_VALIDATION=true in CI builds only. */
export function parseEnv<T extends z.ZodTypeAny>(schema: T, source: NodeJS.ProcessEnv): z.infer<T> {
  if (source.SKIP_ENV_VALIDATION === "true") return source as z.infer<T>;
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Environment is not valid. Fix these in .env:\n${lines.join("\n")}`);
  }
  return result.data;
}
