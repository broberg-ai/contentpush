import { useEffect, useState } from "preact/hooks";
import type { Post } from "./QueueBoard";
import type { CalendarPost } from "./CalendarView";

// F012.4: "Næste 5 stories" — jf. dashboard-mockuppens rail
const STATUS_CHIP: Record<Post["status"], string> = {
  draft: "UDKAST",
  ready: "KLAR",
  posted: "POSTET",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short" });
}

export function NextFive({
  onOpen,
  refreshKey,
}: {
  onOpen?: (post: Post) => void;
  refreshKey?: number;
}) {
  const [next, setNext] = useState<CalendarPost[]>([]);

  useEffect(() => {
    fetch("/api/calendar/next")
      .then((r) => r.json())
      .then(({ next }: { next: CalendarPost[] }) => setNext(next));
  }, [refreshKey]);

  if (!next.length) return null;

  return (
    <div class="next-five" data-testid="next-five">
      <h3>Næste 5 stories</h3>
      {next.map((post) => (
        <button
          key={post.id}
          type="button"
          class="next-item"
          data-testid={`next-item-${post.id}`}
          onClick={() => onOpen?.(post)}
        >
          {post.thumbUrl ? (
            <img class="next-thumb" src={post.thumbUrl} alt="" />
          ) : (
            <span class="next-thumb placeholder" />
          )}
          <span class="next-body">
            <span class="next-headline">{post.headline}</span>
            <small>
              {post.brandName} · {formatDate(post.scheduledDate)}
            </small>
          </span>
          <span class={`idea-status next-status-${post.status}`}>
            {STATUS_CHIP[post.status]}
          </span>
        </button>
      ))}
    </div>
  );
}
