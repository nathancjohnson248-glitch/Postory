import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_TONE, isPostStatus } from "@/lib/posts/state-machine";

export function PostStatusBadge({ status, label }: { status: string; label?: string }) {
  if (!isPostStatus(status)) return <Badge>{status}</Badge>;
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {label ?? STATUS_LABEL[status]}
    </Badge>
  );
}
