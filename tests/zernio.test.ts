import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.ZERNIO_API_KEY = "test-key";
});
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Zernio client", () => {
  it("publishes one post to one account with the key and an idempotency key", async () => {
    const fetch = vi.fn().mockResolvedValue(
      json({ post: { _id: "p1", status: "published", platforms: [{ status: "published", platformPostId: "123", platformPostUrl: "https://x.com/a/status/123" }] } }, 201),
    );
    vi.stubGlobal("fetch", fetch);
    const { publish } = await import("@/lib/social/zernio");
    const out = await publish({ accountId: "acc1", platform: "x", text: "we shipped", imageUrl: "https://cdn.test/i.png", idempotencyKey: "post:1" });

    expect(out).toEqual({ postId: "123", url: "https://x.com/a/status/123", providerPostId: "p1" });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://zernio.com/api/v1/posts");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(init.headers["Idempotency-Key"]).toBe("post:1");
    expect(JSON.parse(init.body)).toEqual({
      content: "we shipped",
      publishNow: true,
      platforms: [{ platform: "twitter", accountId: "acc1" }],
      mediaItems: [{ type: "image", url: "https://cdn.test/i.png" }],
    });
  });

  it("reports a network rejection with its category, never as published", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ post: { _id: "p1", status: "failed", platforms: [{ status: "failed", errorCategory: "auth_expired", errorMessage: "Token expired" }] } })),
    );
    const { publish } = await import("@/lib/social/zernio");
    await expect(publish({ accountId: "a", platform: "linkedin", text: "t", imageUrl: null, idempotencyKey: "k" })).rejects.toMatchObject({ code: "platform_auth_failed" });
  });

  it("treats an unconfirmed post as outcome unknown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ post: { _id: "p1", status: "publishing", platforms: [{ status: "publishing" }] } })));
    const { publish } = await import("@/lib/social/zernio");
    const error = await publish({ accountId: "a", platform: "threads", text: "t", imageUrl: null, idempotencyKey: "k" }).catch((e) => e);
    expect(error.code).toBe("unexpected_response");
    expect(error.options.outcomeUnknown).toBe(true);
  });

  it("maps accounts to Postory networks and drops ones Postory doesn't post to", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json({
          accounts: [
            { _id: "a1", platform: "twitter", username: "acme", displayName: "Acme", platformUserId: "99", profilePicture: "https://pbs.test/a.jpg", isActive: true },
            { _id: "a2", platform: "linkedin", username: "Jane Doe", displayName: "Jane Doe", needsReconnection: true },
            { _id: "a3", platform: "youtube", username: "acmetv" },
          ],
        }),
      ),
    );
    const { listAccounts } = await import("@/lib/social/zernio");
    const accounts = await listAccounts("prof1");
    expect(accounts.map((a) => [a.platform, a.externalId, a.needsReconnect])).toEqual([
      ["x", "a1", false],
      ["linkedin", "a2", true],
    ]);
    expect(accounts[0].metadata).toMatchObject({ name: "Acme", username: "acme", picture: "https://pbs.test/a.jpg" });
    expect(accounts[1].metadata).toMatchObject({ username: null }); // a name, not a handle
  });

  it("treats a refused API key as Postory's problem, not the customer's account", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "Invalid API key" }, 401)));
    const { listAccounts } = await import("@/lib/social/zernio");
    await expect(listAccounts("prof1")).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("finds the user's profile by external id and creates it only when missing", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ profiles: [] }))
      .mockResolvedValueOnce(json({ profile: { _id: "prof9", externalId: "user-1" } }, 201));
    vi.stubGlobal("fetch", fetch);
    const { profileFor } = await import("@/lib/social/zernio");
    expect(await profileFor("user-1")).toBe("prof9");
    expect(fetch.mock.calls[0][0]).toBe("https://zernio.com/api/v1/profiles?externalId=user-1");
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ externalId: "user-1" });
  });
});
