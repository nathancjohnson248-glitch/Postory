"use client";

import { useState } from "react";
import type { Platform } from "@/lib/social/platforms";
import { AssistantPanel } from "./assistant-panel";
import { Composer, type GenerationAvailability } from "./composer";

export function CreateWorkspace(props: {
  initialText: string;
  connected: { platform: Platform; name: string }[];
  defaultPlatforms: Platform[];
  availability: GenerationAvailability;
  assistant: { enabled: boolean; reason?: string };
  timezone: string;
}) {
  const [text, setText] = useState(props.initialText);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <Composer connected={props.connected} defaultPlatforms={props.defaultPlatforms} availability={props.availability} text={text} onTextChange={setText} />
      <AssistantPanel enabled={props.assistant.enabled} disabledReason={props.assistant.reason} timezone={props.timezone} onUseStory={setText} />
    </div>
  );
}
