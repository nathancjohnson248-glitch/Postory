import "server-only";

import { generateStructured, LlmError } from "./llm";
import { PLAN_SYSTEM, planUserPrompt, type BusinessContext } from "./prompts";
import { ModelPlan, ValidatedPlan, type Plan } from "./types";

export type PlanInput = {
  context: BusinessContext;
  horizonDays: 7 | 14;
  today: string;
  connected: string[];
  recentStories: { title: string; summary: string | null; createdAt: string; networks: string[] }[];
  scheduled: { platform: string; when: string; story: string }[];
  lastPostedByNetwork: Record<string, string | null>;
};

/** A grounded content plan: opportunities from real data, questions where data is missing. */
export async function planContent(input: PlanInput): Promise<Plan> {
  const data = [
    `Connected networks: ${input.connected.length ? input.connected.join(", ") : "none yet"}`,
    `Last published per network: ${Object.entries(input.lastPostedByNetwork).map(([k, v]) => `${k}=${v ?? "never"}`).join(", ") || "nothing published yet"}`,
    `Already scheduled (don't repeat): ${input.scheduled.length ? input.scheduled.map((s) => `${s.platform} ${s.when} (${s.story})`).join("; ") : "nothing"}`,
    "Recent stories (newest first):",
    ...(input.recentStories.length
      ? input.recentStories.map((s) => `- ${s.createdAt}: ${s.title}${s.summary ? ` — ${s.summary}` : ""} [posted to: ${s.networks.join(", ") || "not yet"}]`)
      : ["- none yet"]),
  ].join("\n");

  const raw = await generateStructured({
    system: PLAN_SYSTEM,
    turns: [{ role: "user", content: planUserPrompt({ context: input.context, horizonDays: input.horizonDays, today: input.today, data }) }],
    schema: ModelPlan,
    name: "content_plan",
  });
  const parsed = ValidatedPlan.safeParse({ ...raw, ideas: raw.ideas.slice(0, 10), questions: raw.questions.slice(0, 6) });
  if (!parsed.success) throw new LlmError("invalid_output", "The plan came back in a shape Postory couldn't use. Try again.");
  return parsed.data;
}
