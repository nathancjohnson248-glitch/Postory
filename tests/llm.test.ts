import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

beforeEach(() => {
  vi.resetModules();
  process.env.AI_TEXT_API_KEY = "test-token";
  process.env.AI_TEXT_BASE_URL = "https://models.example.test/v1/";
  process.env.AI_TEXT_MODEL = "writer-model";
  delete process.env.AI_TEXT_FAST_MODEL;
});
afterEach(() => vi.unstubAllGlobals());

const reply = (content: string, status = 200) =>
  new Response(JSON.stringify(status === 200 ? { choices: [{ message: { content } }] } : { error: { code: "x", message: content } }), { status });

describe("OpenAI-compatible text handler", () => {
  it("sends an OpenAI-style chat completion to the configured base URL with the token", async () => {
    const fetch = vi.fn().mockResolvedValue(reply('{"title":"iOS launch"}'));
    vi.stubGlobal("fetch", fetch);
    const { generateStructured } = await import("@/lib/ai/llm");
    const out = await generateStructured({ system: "Be brief.", turns: [{ role: "user", content: "we shipped" }], schema: z.object({ title: z.string() }), name: "t" });

    expect(out).toEqual({ title: "iOS launch" });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://models.example.test/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("writer-model");
    expect(body.messages[0]).toMatchObject({ role: "system" });
    expect(body.messages[0].content).toContain('"title"'); // schema is in the instructions
    expect(body.messages[1]).toEqual({ role: "user", content: "we shipped" });
  });

  it("tolerates a code fence around the JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply('Sure!\n```json\n{"ok": true}\n```')));
    const { generateStructured } = await import("@/lib/ai/llm");
    expect(await generateStructured({ system: "", turns: [{ role: "user", content: "x" }], schema: z.object({ ok: z.boolean() }), name: "t" })).toEqual({ ok: true });
  });

  it("retries a malformed answer once, then gives up honestly", async () => {
    const fetch = vi.fn().mockResolvedValue(reply("not json at all"));
    vi.stubGlobal("fetch", fetch);
    const { generateStructured, LlmError } = await import("@/lib/ai/llm");
    await expect(generateStructured({ system: "", turns: [{ role: "user", content: "x" }], schema: z.object({ ok: z.boolean() }), name: "t" })).rejects.toBeInstanceOf(LlmError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects output that doesn't match the schema", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply('{"ok": "yes"}')));
    const { generateStructured } = await import("@/lib/ai/llm");
    await expect(generateStructured({ system: "", turns: [{ role: "user", content: "x" }], schema: z.object({ ok: z.boolean() }), name: "t" })).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("turns a bad token into a plain 'saved, try again' message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply("Bad credentials", 401)));
    const { generateStructured } = await import("@/lib/ai/llm");
    await expect(generateStructured({ system: "", turns: [{ role: "user", content: "x" }], schema: z.object({ ok: z.boolean() }), name: "t" })).rejects.toMatchObject({
      code: "unavailable",
      message: expect.stringContaining("saved"),
    });
  });

  it("treats a plain 'OK' page (a retired or wrong endpoint) as a failure, not a reply", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("OK", { status: 200 })));
    const { generateStructured } = await import("@/lib/ai/llm");
    await expect(generateStructured({ system: "", turns: [{ role: "user", content: "x" }], schema: z.object({ ok: z.boolean() }), name: "t" })).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("is off when no key is configured", async () => {
    delete process.env.AI_TEXT_API_KEY;
    const { generateStructured, llmProvider } = await import("@/lib/ai/llm");
    expect(llmProvider()).toBeNull();
    await expect(generateStructured({ system: "", turns: [], schema: z.object({}), name: "t" })).rejects.toMatchObject({ code: "unavailable" });
  });
});
