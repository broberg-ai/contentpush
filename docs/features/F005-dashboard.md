# F005 — P5 Dashboard UI (queue, review, download package)

> Source spec: `contentpush_plan.md` (Plan v4) §1 step 4, §3 (client components + flow), §7 phase P5. Depends on F002, F003.

## Motivation
This is the surface Christian actually touches: a calm, card-based queue (cardmem paradigm) where each generated post is reviewed, regenerated if needed, approved, and downloaded as a ready-to-post package. Everything upstream (text, media, cron) converges here.

## Scope
- `QueueBoard` + `PostCard` (Preact) — kanban-like queue by status (`draft` / `ready` / `posted`).
- Review actions: approve, regenerate (re-calls F002/F003), "mark ready", "mark posted". Marking posted auto-schedules the next post +14 days.
- `DownloadPackage` — zip: `linkedin.txt`, `instagram.txt`, `facebook.txt`, `media/`.
- `LibraryGrid` surfacing the F003 stock library for image selection.

## Non-goals
- No automated posting (F007). No new generation logic (reuses F002/F003 routes).

## Design + Lens
- Pure `@broberg/theme` tokens, earth-tone + serif, cardmem look. No shadcn/Tailwind, no native dialogs/selects.
- Every interactive element carries a semantic `data-testid` (F086) so Lens can drive + verify before Done.
- Buttons: `:hover`, `:active`, loading indicator >100ms, post-action confirmation, error state.

## Dependencies
- F002 (text) + F003 (media) must exist to render/regenerate a real draft.

## Stories
- **F005.1** — `QueueBoard` + `PostCard` queue view (draft/ready/posted), cardmem paradigm, data-testid coverage.
- **F005.2** — Review actions: approve / regenerate / mark-ready / mark-posted (+14d auto-schedule on posted).
- **F005.3** — `DownloadPackage` zip (linkedin.txt, instagram.txt, facebook.txt, media/).
