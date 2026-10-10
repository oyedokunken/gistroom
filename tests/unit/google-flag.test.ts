import { describe, expect, it } from "vitest";
import { googleOffResponse, isGoogleEnabled } from "../../apps/web/src/server/auth/google-flag";

describe("Google sign in flag", () => {
  it("is off unless the flag is exactly true", () => {
    expect(isGoogleEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isGoogleEnabled({ GOOGLE_AUTH_ENABLED: "false" } as unknown as NodeJS.ProcessEnv)).toBe(
      false,
    );
    expect(isGoogleEnabled({ GOOGLE_AUTH_ENABLED: "1" } as unknown as NodeJS.ProcessEnv)).toBe(
      false,
    );
    expect(isGoogleEnabled({ GOOGLE_AUTH_ENABLED: "true" } as unknown as NodeJS.ProcessEnv)).toBe(
      true,
    );
  });
  it("answers like a missing route while off", async () => {
    const res = googleOffResponse();
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });
});
