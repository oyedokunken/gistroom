import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The refusals are logged as errors. Keep that out of the test output.
vi.mock("../../apps/web/src/server/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { resetEnvCache } from "../../apps/web/src/server/env";
import {
  assertMediaBucketPrivate,
  createSignedUrl,
  resetMediaBucketCheck,
} from "../../apps/web/src/server/storage";

const SUPABASE = "https://storage.test";

interface Call {
  url: string;
  method: string;
  body: string | null;
}

/** A tiny fake of the storage REST API. Buckets are looked up by id, and signing returns a tokened path. */
function fakeStorage(buckets: Record<string, { public: boolean } | undefined>, failWith?: number) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: (init?.body as string) ?? null });
    if (failWith) return new Response("nope", { status: failWith });
    const bucket = /\/storage\/v1\/bucket\/([^/?]+)$/.exec(url);
    if (bucket) {
      const found = buckets[decodeURIComponent(bucket[1] as string)];
      return found
        ? Response.json({ id: bucket[1], public: found.public })
        : new Response("{}", { status: 404 });
    }
    const sign = /\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/.exec(url);
    if (sign) {
      return Response.json({ signedURL: `/object/sign/${sign[1]}/${sign[2]}?token=t0k3n` });
    }
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

beforeEach(() => {
  vi.stubEnv("SKIP_ENV_VALIDATION", "");
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/none");
  vi.stubEnv("DIRECT_URL", "postgresql://u:p@localhost:5432/none");
  vi.stubEnv("DATABASE_SCHEMA", "gistroom_test");
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  vi.stubEnv("REALTIME_PASS_SECRET", "r".repeat(40));
  vi.stubEnv("INTERNAL_SERVICE_TOKEN", "i".repeat(40));
  vi.stubEnv("CRON_SECRET", "c".repeat(24));
  vi.stubEnv("SUPABASE_URL", SUPABASE);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  vi.stubEnv("SUPABASE_MEDIA_BUCKET", "media");
  vi.stubEnv("SUPABASE_PUBLIC_BUCKET", "avatars");
  resetEnvCache();
  resetMediaBucketCheck();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetEnvCache();
  resetMediaBucketCheck();
});

describe("signed links", () => {
  it("asks for a five minute link by default and never builds a public URL", async () => {
    const { calls } = fakeStorage({ media: { public: false } });
    const url = await createSignedUrl("media", "dm/c1/u1/a b.jpg");
    expect(url).toBe(`${SUPABASE}/storage/v1/object/sign/media/dm/c1/u1/a%20b.jpg?token=t0k3n`);
    expect(url).not.toContain("/object/public/");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("POST");
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ expiresIn: 300 });
  });

  it("passes a shorter expiry through", async () => {
    const { calls } = fakeStorage({ media: { public: false } });
    await createSignedUrl("media", "dm/x.jpg", 60);
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ expiresIn: 60 });
  });

  it("fails when the storage service refuses to sign", async () => {
    fakeStorage({ media: { public: false } }, 500);
    await expect(createSignedUrl("media", "dm/x.jpg")).rejects.toMatchObject({ status: 502 });
  });
});

describe("the media bucket must be private", () => {
  it("accepts a private bucket and remembers the answer for a while", async () => {
    const { fetchMock } = fakeStorage({ media: { public: false } });
    await assertMediaBucketPrivate(1_000);
    await assertMediaBucketPrivate(1_000 + 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again once the remembered answer is old", async () => {
    const { fetchMock } = fakeStorage({ media: { public: false } });
    await assertMediaBucketPrivate(1_000);
    await assertMediaBucketPrivate(1_000 + 11 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses a public bucket and does not remember it", async () => {
    const { fetchMock } = fakeStorage({ media: { public: true } });
    await expect(assertMediaBucketPrivate()).rejects.toMatchObject({ status: 503 });
    await expect(assertMediaBucketPrivate()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses when media and avatars share one bucket, without asking the service", async () => {
    vi.stubEnv("SUPABASE_PUBLIC_BUCKET", "media");
    resetEnvCache();
    const { fetchMock } = fakeStorage({ media: { public: false } });
    await expect(assertMediaBucketPrivate()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a bucket that does not exist", async () => {
    fakeStorage({});
    await expect(assertMediaBucketPrivate()).rejects.toMatchObject({ status: 503 });
  });

  it("fails closed when the storage service cannot be asked", async () => {
    fakeStorage({ media: { public: false } }, 500);
    await expect(assertMediaBucketPrivate()).rejects.toMatchObject({ status: 502 });
  });
});
