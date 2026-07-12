import { useEffect, useState } from "preact/hooks";

export type Post = {
  id: string;
  brandId: string;
  brandName: string | null;
  headline: string;
  linkedinText: string | null;
  instagramText: string | null;
  facebookText: string | null;
  hashtags: Record<string, string[]> | null;
  status: "draft" | "ready" | "posted";
  scheduledDate: string | null;
  movedReason?: string | null;
  postedAt: string | null;
  createdAt: string;
};

const COLUMNS: Array<{ status: Post["status"]; title: string }> = [
  { status: "draft", title: "Kladder" },
  { status: "ready", title: "Klar til at poste" },
  { status: "posted", title: "Postet" },
];

const PLATFORM_LABELS: Array<[keyof Post, string]> = [
  ["linkedinText", "LI"],
  ["instagramText", "IG"],
  ["facebookText", "FB"],
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
  });
}

export function PostCard({
  post,
  onOpen,
}: {
  post: Post;
  onOpen?: (post: Post) => void;
}) {
  return (
    <button
      type="button"
      class="post-card"
      data-testid={`post-card-${post.id}`}
      onClick={() => onOpen?.(post)}
    >
      <span class="post-card-brand">{post.brandName ?? "—"}</span>
      <span class="post-card-headline">{post.headline}</span>
      <span class="post-card-meta">
        <span class="post-card-platforms">
          {PLATFORM_LABELS.filter(([field]) => post[field]).map(([, label]) => (
            <span key={label} class="platform-badge">
              {label}
            </span>
          ))}
        </span>
        <span class="post-card-date">
          {post.status === "posted"
            ? `postet ${formatDate(post.postedAt)}`
            : formatDate(post.scheduledDate)}
        </span>
      </span>
    </button>
  );
}

export function QueueBoard({
  activeBrandId,
  onOpen,
  refreshKey,
}: {
  activeBrandId: string | null;
  onOpen?: (post: Post) => void;
  refreshKey?: number;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/posts")
      .then((r) => r.json())
      .then(({ posts }: { posts: Post[] }) => setPosts(posts))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const visible = activeBrandId
    ? posts.filter((p) => p.brandId === activeBrandId)
    : posts;

  return (
    <section class="queue-board" data-testid="queue-board-root">
      {COLUMNS.map(({ status, title }) => {
        const column = visible.filter((p) => p.status === status);
        return (
          <div
            key={status}
            class="queue-column"
            data-testid={`queue-column-${status}`}
          >
            <h3>
              {title} <span class="queue-count">{column.length}</span>
            </h3>
            {loading && <p class="queue-empty">Henter…</p>}
            {!loading && column.length === 0 && (
              <p class="queue-empty">Ingen opslag</p>
            )}
            {column.map((post) => (
              <PostCard key={post.id} post={post} onOpen={onOpen} />
            ))}
          </div>
        );
      })}
    </section>
  );
}
