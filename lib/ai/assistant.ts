import "server-only";

import { generateStructured, LlmError } from "./llm";
import { ASSISTANT_SYSTEM, REPLY_SYSTEM, renderBusinessContext, type BusinessContext } from "./prompts";
import { ModelAssistantReply, ModelReplyDraft, ValidatedAssistantReply } from "./types";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type WorkspaceSnapshot = {
  now: string;
  timezone: string;
  posts: { id: string; platform: string; status: string; scheduledFor: string | null; content: string; story: string }[];
};

export async function askAssistant(input: { messages: ChatMessage[]; context: BusinessContext; workspace: WorkspaceSnapshot }) {
  const workspace = `WORKSPACE (current time ${input.workspace.now}, owner's timezone ${input.workspace.timezone}):\n${
    input.workspace.posts.length
      ? input.workspace.posts
          .map((p) => `- postId=${p.id} | ${p.platform} | ${p.status}${p.scheduledFor ? ` | scheduled ${p.scheduledFor}` : ""} | story: ${p.story} | <post>${p.content.slice(0, 280)}</post>`)
          .join("\n")
      : "(no posts yet)"
  }`;

  const raw = await generateStructured({
    system: `${ASSISTANT_SYSTEM}\n\n${renderBusinessContext(input.context)}\n\n${workspace}`,
    turns: input.messages.slice(-12),
    schema: ModelAssistantReply,
    name: "assistant_reply",
  });

  // Keep only well-formed proposals that reference real posts in this workspace.
  const knownIds = new Set(input.workspace.posts.map((p) => p.id));
  const scheduled = new Set(input.workspace.posts.filter((p) => p.status === "scheduled").map((p) => p.id));
  const cleaned = {
    reply: raw.reply,
    proposals: raw.proposals
      .map((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null)))
      .filter((p) => {
        if (p.type === "edit_post") return knownIds.has(String(p.postId));
        if (p.type === "reschedule_post") return scheduled.has(String(p.postId));
        return true;
      }),
  };
  const parsed = ValidatedAssistantReply.safeParse(cleaned);
  if (!parsed.success) return { reply: raw.reply.slice(0, 4000) || "I couldn't put that together. Try again.", proposals: [] };
  return parsed.data;
}

export async function draftReply(input: { comment: string; author: string | null; platform: string; context: BusinessContext }) {
  const raw = await generateStructured({
    system: `${REPLY_SYSTEM}\n\n${renderBusinessContext(input.context)}`,
    turns: [{ role: "user", content: `Platform: ${input.platform}\nFrom: ${input.author ?? "someone"}\n<post>${input.comment}</post>\nDraft a reply.` }],
    schema: ModelReplyDraft,
    name: "reply_draft",
  });
  if (!raw.reply?.trim()) throw new LlmError("invalid_output", "No reply came back. Try again.");
  return { reply: raw.reply.trim().slice(0, 2000), category: raw.category };
}
