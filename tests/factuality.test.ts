import { describe, expect, it } from "vitest";
import { findUnsupportedNumbers } from "@/lib/ai/factuality";
import { checkGeneration } from "@/lib/ai/generate-posts";

describe("findUnsupportedNumbers", () => {
  const story = "We launched v2 today and got 37 downloads in the first hour.";

  it("allows numbers from the story, exactly", () => {
    expect(findUnsupportedNumbers("37 downloads in hour one", story)).toEqual([]);
  });

  it("flags numbers that aren't in the story", () => {
    expect(findUnsupportedNumbers("Nearly 40 downloads!", story)).toEqual(["40"]);
  });

  it("lets a story's v2 become version 2", () => {
    expect(findUnsupportedNumbers("Version 2 is live", story)).toEqual([]);
  });
});

describe("checkGeneration", () => {
  const base = { facts: ["Shipped something"], storyTitle: "Update", summary: "", angles: [], missingInformation: ["What did you ship?"], schedulingSuggestion: null };

  it("hands questions back when the story is too thin and asking is allowed", () => {
    const result = checkGeneration({ ...base, posts: [], needsMoreDetail: true }, ["x"], "shipped stuff", true);
    expect(result.needsMoreDetail).toBe(true);
    expect(result.posts).toEqual([]);
  });

  it("treats a thin story as an error when asking isn't possible", () => {
    expect(() => checkGeneration({ ...base, posts: [], needsMoreDetail: true }, ["x"], "shipped stuff")).toThrow(/more detail/);
  });

  it("reports networks the writer skipped so they can be retried", () => {
    const post = { platform: "x", content: "Dark mode is live.", angle: "", reasoning: "", mediaNeeded: false, mediaSuggestion: null };
    const result = checkGeneration({ ...base, posts: [post], needsMoreDetail: false }, ["x", "linkedin"], "Dark mode is live.");
    expect(result.posts.map((p) => p.platform)).toEqual(["x"]);
    expect(result.missingPlatforms).toEqual(["linkedin"]);
  });
});

import { enforcePreferences, findCliches } from "@/lib/ai/voice-lint";

describe("voice lint", () => {
  it("flags stock AI phrasing and em-dash habits", () => {
    expect(findCliches("We're thrilled to announce our game-changing app — it's here — finally")).toEqual(
      expect.arrayContaining(["excited to announce", "game-changer", "2 em dashes"]),
    );
    expect(findCliches("shipped the ios app today. 37 downloads in the first hour.")).toEqual([]);
  });

  it("removes hashtags and emoji when the owner said never", () => {
    expect(enforcePreferences("37 downloads 📱\nStill early.\n#indieapp #habittracker", { emoji: "never", hashtags: "never" })).toBe("37 downloads\nStill early.");
    expect(enforcePreferences("We're #1 on our list 🎉", { emoji: "voice", hashtags: "platform" })).toBe("We're #1 on our list 🎉");
  });
});
