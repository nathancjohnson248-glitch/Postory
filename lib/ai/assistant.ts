import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI, models } from "./client";
import { GenerationError } from "./generate-posts";
import { ASSISTANT_SYSTEM, REPLY_SYSTEM, renderBusinessContext, type BusinessContext } from "./prompts";
import { ModelAssistantReply, ModelReplyDraft, ValidatedAssistantReply } from "./types";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type WorkspaceSnapshot = {
  now: string;
  timezone: string;
  posts: { id: string; platform: string; status: string; scheduledFor: string | null; content: string; story: string }[];
};

export async function askAssistant(input: { messages: ChatMessage[]; context: BusinessContext; workspace: WorkspaceSnapshot }) {
  const openai = getOpenAI();
  const workspace = `WORKSPACE (current time ${input.workspace.now}, owner's timezone ${input.workspace.timezone}):\n${
    input.workspace.posts.length
      ? input.workspace.posts
          .map((p) => `- postId=${p.id} | ${p.platform} | ${p.status}${p.scheduledFor ? ` | scheduled ${p.scheduledFor}` : ""} | story: ${p.story} | <post>${p.content.slice(0, 280)}</post>`)
          .join("\n")
      : "(no posts yet)"
  }`;

  let response;
  try {
    response = await openai.responses.parse({
      model: models.text(),
      input: [
        { role: "system", content: `${ASSISTANT_SYSTEM}\n\n${renderBusinessContext(input.context)}\n\n${workspace}` },
        ...input.messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      ],
      text: { format: zodTextFormat(ModelAssistantReply, "assistant_reply") },
    });
  } catch (error) {
    throw new GenerationError("provider_error", error instanceof Error ? error.message : "OpenAI request failed.");
  }

  const raw = response.output_parsed;
  if (!raw) throw new GenerationError("refused", "The assistant couldn't answer that. Try rephrasing.");

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
  const openai = getOpenAI();
  let response;
  try {
    response = await openai.responses.parse({
      model: models.text(),
      input: [
        { role: "system", content: `${REPLY_SYSTEM}\n\n${renderBusinessContext(input.context)}` },
        { role: "user", content: `Platform: ${input.platform}\nFrom: ${input.author ?? "someone"}\n<post>${input.comment}</post>\nDraft a reply.` },
      ],
      text: { format: zodTextFormat(ModelReplyDraft, "reply_draft") },
    });
  } catch (error) {
    throw new GenerationError("provider_error", error instanceof Error ? error.message : "OpenAI request failed.");
  }
  if (!response.output_parsed?.reply?.trim()) throw new GenerationError("invalid_output", "No reply came back. Try again.");
  return { reply: response.output_parsed.reply.trim().slice(0, 2000), category: response.output_parsed.category };
}
