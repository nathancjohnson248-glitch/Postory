"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { approveAllInStory } from "@/app/_actions/posts";
import { archiveStory, deleteStory, restoreStory } from "@/app/_actions/stories";

export function StoryToolbar({ storyId, archived, reviewCount }: { storyId: string; archived: boolean; reviewCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {reviewCount > 0 ? (
        <Button
          variant="accent"
          icon={<CheckCheck className="size-4" />}
          loading={pending}
          onClick={() =>
            start(async () => {
              const result = await approveAllInStory(storyId);
              if (result.ok) toast.success(`Approved ${result.data.approved} ${result.data.approved === 1 ? "post" : "posts"}.`);
              else toast.error(result.error.message);
              router.refresh();
            })
          }
        >
          Approve all ({reviewCount})
        </Button>
      ) : null}
      {archived ? (
        <Button
          variant="secondary"
          icon={<ArchiveRestore className="size-4" />}
          onClick={() =>
            start(async () => {
              const result = await restoreStory(storyId);
              if (result.ok) toast.success("Story restored.");
              else toast.error(result.error.message);
              router.refresh();
            })
          }
        >
          Restore
        </Button>
      ) : (
        <ConfirmButton
          variant="ghost"
          confirmVariant="primary"
          icon={<Archive className="size-4" />}
          title="Archive this story?"
          description="It moves to Archived in your library. Nothing is deleted, and you can restore it any time."
          confirmLabel="Archive"
          onConfirm={async () => {
            const result = await archiveStory(storyId);
            if (result.ok) toast.success("Archived.");
            else toast.error(result.error.message);
            router.refresh();
          }}
        >
          Archive
        </ConfirmButton>
      )}
      <ConfirmButton
        variant="ghost"
        icon={<Trash2 className="size-4" />}
        title="Delete this story?"
        description="The story and its posts are removed from Postory permanently. Anything already published stays on the networks."
        confirmLabel="Delete story"
        onConfirm={async () => {
          const result = await deleteStory(storyId);
          if (result && !result.ok) toast.error(result.error.message);
        }}
      >
        Delete
      </ConfirmButton>
    </div>
  );
}
