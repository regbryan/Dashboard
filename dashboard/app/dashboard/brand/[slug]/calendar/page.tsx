import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/image-url";
import StatusBadge from "@/components/StatusBadge";

/**
 * Weekly calendar view of every post for a brand. Posts are placed on
 * their scheduled `date` and laid out in 7-day rows (Mon–Sun). Clicking
 * any pill jumps into the existing post detail page.
 *
 * Read-only for now — drag-to-reschedule lands in a follow-up once we
 * confirm `posts.date` is safe to mutate from the UI.
 */
export const dynamic = "force-dynamic";

type Post = {
  id: number;
  post_number: number;
  date: string | null;
  day: string | null;
  post_type: string | null;
  content_pillar: string | null;
  concept: string | null;
  visual_direction: string | null;
  caption: string | null;
  status: string;
  file_path: string | null;
  updated_at: string | null;
};

export default async function BrandCalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, color_primary")
    .eq("id", slug)
    .single();

  const { data: postRows } = await supabase
    .from("posts")
    .select(
      "id, post_number, date, day, post_type, content_pillar, concept, visual_direction, caption, status, file_path, updated_at"
    )
    .eq("brand_id", slug)
    .order("date", { ascending: true });

  const posts = ((postRows ?? []) as Post[]).filter((p) => p.date);
  const accent = brand?.color_primary || "#8b5cff";

  const weeks = groupByWeek(posts);
  const today = todayUTC();

  return (
    <div style={{ padding: "28px 0 48px" }}>
      <div>
        {weeks.length === 0 ? (
          <div
            className="lg-surface--card"
            style={{
              borderRadius: "16px",
              padding: "60px 24px",
              textAlign: "center",
              color: "#7a7a88",
              fontSize: "14px",
              backdropFilter: "blur(10px) saturate(145%)",
              WebkitBackdropFilter: "blur(10px) saturate(145%)",
            }}
          >
            Nothing on the calendar yet. Posts with a scheduled date will land
            here automatically. Start by uploading or generating content from
            the Designs tab.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {weeks.map((week) => (
              <WeekRow
                key={week.start}
                week={week}
                brandId={slug}
                today={today}
                accent={accent}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type Week = { start: string; days: Day[] };
type Day = { date: string; posts: Post[] };

function groupByWeek(posts: Post[]): Week[] {
  if (posts.length === 0) return [];

  const byDate: Record<string, Post[]> = {};
  for (const p of posts) {
    if (!p.date) continue;
    (byDate[p.date] ??= []).push(p);
  }

  const allDates = Object.keys(byDate).sort();
  const first = parseDateUTC(allDates[0]);
  const last = parseDateUTC(allDates[allDates.length - 1]);

  const start = new Date(first);
  const dow = (first.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  start.setUTCDate(start.getUTCDate() - dow);

  const end = new Date(last);
  const endDow = (last.getUTCDay() + 6) % 7;
  end.setUTCDate(end.getUTCDate() + (6 - endDow));

  const weeks: Week[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const weekStart = formatDateUTC(cursor);
    const days: Day[] = [];
    for (let i = 0; i < 7; i++) {
      const date = formatDateUTC(cursor);
      days.push({ date, posts: byDate[date] ?? [] });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push({ start: weekStart, days });
  }
  return weeks;
}

function WeekRow({
  week,
  brandId,
  today,
  accent,
}: {
  week: Week;
  brandId: string;
  today: string;
  accent: string;
}) {
  const startDate = parseDateUTC(week.start);
  const endDate = parseDateUTC(week.days[6].date);
  const label = `${formatHuman(startDate)} – ${formatHuman(endDate, true)}`;
  const weekCount = week.days.reduce((acc, d) => acc + d.posts.length, 0);

  return (
    <div>
      <div
        className="flex items-baseline"
        style={{ justifyContent: "space-between", marginBottom: "8px" }}
      >
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: "white" }}>
          {label}
        </h3>
        <span style={{ fontSize: "12px", color: "#7a7a88" }}>
          {weekCount} post{weekCount === 1 ? "" : "s"}
        </span>
      </div>
      <div
        style={{
          margin: "0 -20px",
          padding: "0 20px",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(140px, 1fr))",
            gap: "8px",
          }}
        >
          {week.days.map((day) => (
            <DayCell
              key={day.date}
              day={day}
              brandId={brandId}
              today={today}
              accent={accent}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayCell({
  day,
  brandId,
  today,
  accent,
}: {
  day: Day;
  brandId: string;
  today: string;
  accent: string;
}) {
  const date = parseDateUTC(day.date);
  const isToday = day.date === today;
  const isPast = day.date < today;
  const dayNum = date.getUTCDate();
  const dayName = date.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });

  return (
    <div
      style={{
        background: isToday ? `${accent}0F` : "#0f0f1a",
        border: `1px solid ${isToday ? accent : "#1a1a2e"}`,
        borderRadius: "10px",
        padding: "8px",
        minHeight: "140px",
        opacity: isPast && day.posts.length === 0 ? 0.4 : 1,
      }}
    >
      <div
        className="flex items-baseline"
        style={{
          justifyContent: "space-between",
          marginBottom: "6px",
          fontSize: "10px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#7a7a88",
        }}
      >
        <span>{dayName}</span>
        <span style={{ color: isToday ? accent : undefined }}>{dayNum}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {day.posts.map((p) => (
          <PostPill key={p.id} post={p} brandId={brandId} />
        ))}
      </div>
    </div>
  );
}

function PostPill({ post, brandId }: { post: Post; brandId: string }) {
  // Videos (.mp4/.mov/.webm) can't render in <img>. Detect by extension
  // and show a labeled placeholder for those file types.
  const isVideo = post.file_path
    ? /\.(mp4|mov|webm|m4v)$/i.test(post.file_path)
    : false;
  const thumb = !isVideo
    ? getImageUrl(brandId, post.file_path, post.updated_at)
    : null;
  return (
    <Link
      href={`/dashboard/brand/${brandId}/post/${post.id}`}
      style={{
        display: "block",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #1a1a2e",
        background: "#0a0a14",
        textDecoration: "none",
        transition: "border-color 0.15s ease",
      }}
    >
      {thumb ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            background: "#0a0a14",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={post.concept ?? `Post ${post.post_number}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>
      ) : isVideo ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            background:
              "linear-gradient(135deg, rgba(192,132,252,0.12) 0%, rgba(15,15,26,0.6) 70%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            padding: "8px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              background: "rgba(192,132,252,0.18)",
              border: "1px solid rgba(192,132,252,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d9b4ff",
              fontSize: "11px",
              paddingLeft: "2px",
            }}
          >
            ▶
          </div>
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#c084fc",
              fontWeight: 600,
            }}
          >
            {post.post_type ?? "Video"}
          </div>
        </div>
      ) : (
        // Pre-generation state: show the prompt of what's going to be
        // designed. Concept is the primary line, visual_direction the
        // fallback, caption a last resort. Content pillar shows as the
        // eyebrow above so the operator can tell at a glance what
        // bucket this post is from. Pill flips to <img> once file_path
        // is set (generation complete).
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            background: "#0a0a14",
            padding: "8px 9px",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
          }}
        >
          {post.content_pillar && (
            <div
              style={{
                fontSize: "8px",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: "#9999a6",
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {post.content_pillar}
            </div>
          )}
          <p
            style={{
              margin: 0,
              fontSize: "10px",
              lineHeight: 1.4,
              color: "#bfbfcc",
              // Clamp the preview to fit the square cell — long
              // concepts truncate with an ellipsis rather than push
              // the cell taller.
              display: "-webkit-box",
              WebkitLineClamp: 6,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {post.concept ||
              post.visual_direction ||
              post.caption ||
              post.post_type ||
              "Awaiting prompt"}
          </p>
        </div>
      )}
      <div
        className="flex items-center"
        style={{
          justifyContent: "space-between",
          padding: "4px 6px",
          gap: "4px",
        }}
      >
        <span style={{ fontSize: "9px", color: "#7a7a88" }}>
          #{post.post_number}
        </span>
        <StatusBadge status={post.status} />
      </div>
    </Link>
  );
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDateUTC(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

function formatDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatHuman(d: Date, withYear?: boolean): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}
