import { describe, expect, it } from "vitest";
import { PLATFORMS, PLATFORM_META, validatePostContent } from "@/lib/social/platforms";

describe("network capabilities", () => {
  it("never claims reading back what a network doesn't publish through Postory", () => {
    for (const p of PLATFORMS) {
      const m = PLATFORM_META[p];
      if (!m.can.publish) expect(m.can.metrics || m.can.comments).toBe(false);
      if (m.connect === "none") expect(m.can.publish).toBe(false);
    }
  });

  it("explains every switched-off capability", () => {
    for (const p of PLATFORMS) {
      const m = PLATFORM_META[p];
      if (!m.can.publish || !m.can.comments || !m.can.metrics) expect(m.limitation ?? "").not.toBe("");
    }
  });

  it("requires an image where the network does", () => {
    expect(validatePostContent("instagram", "hello").some((i) => i.level === "error")).toBe(true);
    expect(validatePostContent("instagram", "hello", [{ kind: "image" }])).toEqual([]);
  });
});
