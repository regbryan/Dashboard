import Link from "next/link";
import { getImageUrl } from "@/lib/image-url";
import EmptyState from "@/components/EmptyState";
import { getBrandPosts } from "@/lib/brand-data";
import StatusBadge from "@/components/StatusBadge";

/**
 * Monthly calendar view of a brand's posts. Opens on the CURRENT month so
 * the operator never has to scroll past old months to reach today. Past /
 * future months are one click away via the prev/next nav (the Designs tab
 * is the full archive). Posts are placed on their scheduled `date` in a
 * standard Mon–Sun month grid; clicking a pill opens the post detail page.
 *
 * Server component — the visible month is a `?month=YYYY-MM` URL param so
 * navigation needs no client JS and stays shareable.
 */
export const dynamic = "force-dynamic";

const ACCENT = "#8b5cff"; // app violet identity (not per-brand)

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const postRows = await getBrandPosts(slug);
  const posts = (postRows as Post[]).filter((p) => p.date);

  const today = todayUTC();
  const currentMonth = today.slice(0, 7);
  const selectedMonth = /^\d{4}-\d{2}$/.test(sp?.month ?? "")
    ? (sp.month as string)
    : currentMonth;

  const weeks = monthWeeks(selectedMonth, posts);
  const monthCount = posts.filter((p) => p.date?.slice(0, 7) === selectedMonth).length;
  const hasAnyPosts = posts.length > 0;

  return (
    <div style={{ padding: "20px 0 48px" }}>
      <MonthNav
        slug={slug}
        selectedMonth={selectedMonth}
        currentMonth={currentMonth}
        monthCount={monthCount}
      />

      {!hasAnyPosts ? (
        <EmptyState>
          Nothing on the calendar yet. Posts with a scheduled date will land
          here automatically. Start by uploading or generating content from the
          Designs tab.
        </EmptyState>
      ) : (
        <>
          <WeekdayHeader />
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {weeks.map((week) => (
              <div
                key={week.start}
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
                    <DayCell key={day.date} day={day} brandId={slug} today={today} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {monthCount === 0 && (
            <p
              style={{
                marginTop: "20px",
                textAlign: "center",
                fontSize: "13px",
                color: "#7a7a88",
              }}
            >
              No posts scheduled in {monthLabel(selectedMonth)}.{" "}
              <Link href={`?month=${currentMonth}`} style={{ color: ACCENT }}>
                Jump to {monthLabel(currentMonth)}
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function MonthNav({
  slug,
  selectedMonth,
  currentMonth,
  monthCount,
}: {
  slug: string;
  selectedMonth: string;
  currentMonth: string;
  monthCount: number;
}) {
  const prev = addMonths(selectedMonth, -1);
  const next = addMonths(selectedMonth, 1);
  const isCurrent = selectedMonth === currentMonth;
  const base = `/dashboard/brand/${slug}/calendar`;

  return (
    <div
      className="flex flex-wrap items-center"
      style={{ gap: "12px", marginBottom: "18px", padding: "0 2px" }}
    >
      <div className="flex items-center" style={{ gap: "6px" }}>
        <NavArrow href={`${base}?month=${prev}`} label="Previous month" dir="prev" />
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "white",
            letterSpacing: "-0.01em",
            minWidth: "168px",
            textAlign: "center",
          }}
        >
          {monthLabel(selectedMonth)}
        </h2>
        <NavArrow href={`${base}?month=${next}`} label="Next month" dir="next" />
      </div>

      <span style={{ fontSize: "12px", color: "#7a7a88" }}>
        {monthCount} post{monthCount === 1 ? "" : "s"} this month
      </span>

      {!isCurrent && (
        <Link
          href={`${base}?month=${currentMonth}`}
          style={{
            marginLeft: "auto",
            fontSize: "12px",
            fontWeight: 600,
            color: "#d9b4ff",
            textDecoration: "none",
            padding: "6px 12px",
            borderRadius: "999px",
            border: `1px solid ${ACCENT}66`,
            background: `${ACCENT}1a`,
          }}
        >
          Today
        </Link>
      )}
    </div>
  );
}

function NavArrow({
  href,
  label,
  dir,
}: {
  href: string;
  label: string;
  dir: "prev" | "next";
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        border: "1px solid #1a1a2e",
        background: "#0f0f1a",
        color: "#bfbfcc",
        fontSize: "15px",
        textDecoration: "none",
      }}
    >
      {dir === "prev" ? "‹" : "›"}
    </Link>
  );
}

function WeekdayHeader() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div
      style={{
        margin: "0 -20px 8px",
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
        {days.map((d) => (
          <div
            key={d}
            style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#7a7a88",
              padding: "0 4px",
            }}
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}

type Week = { start: string; days: Day[] };
type Day = { date: string; posts: Post[]; inMonth: boolean };

function monthWeeks(ym: string, posts: Post[]): Week[] {
  const byDate: Record<string, Post[]> = {};
  for (const p of posts) {
    if (!p.date) continue;
    if (!byDate[p.date]) byDate[p.date] = [];
    byDate[p.date].push(p);
  }

  const [y, m] = ym.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(y, m - 1, 1));
  const lastOfMonth = new Date(Date.UTC(y, m, 0)); // day 0 of next month

  const start = new Date(firstOfMonth);
  start.setUTCDate(start.getUTCDate() - ((firstOfMonth.getUTCDay() + 6) % 7)); // Mon on/before 1st

  const end = new Date(lastOfMonth);
  end.setUTCDate(end.getUTCDate() + (6 - ((lastOfMonth.getUTCDay() + 6) % 7))); // Sun on/after last

  const weeks: Week[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const weekStart = formatDateUTC(cursor);
    const days: Day[] = [];
    for (let i = 0; i < 7; i++) {
      const date = formatDateUTC(cursor);
      days.push({ date, posts: byDate[date] ?? [], inMonth: date.slice(0, 7) === ym });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push({ start: weekStart, days });
  }
  return weeks;
}

function DayCell({
  day,
  brandId,
  today,
}: {
  day: Day;
  brandId: string;
  today: string;
}) {
  const date = parseDateUTC(day.date);
  const isToday = day.date === today;
  const isPast = day.date < today;
  const dayNum = date.getUTCDate();

  return (
    <div
      style={{
        background: isToday ? `${ACCENT}1a` : "#0f0f1a",
        border: `1px solid ${isToday ? ACCENT : "#1a1a2e"}`,
        borderRadius: "10px",
        padding: "8px",
        minHeight: "140px",
        // Out-of-month days are de-emphasized; empty past days fade too.
        opacity: !day.inMonth ? 0.32 : isPast && day.posts.length === 0 ? 0.45 : 1,
      }}
    >
      <div
        className="flex items-baseline"
        style={{
          justifyContent: "flex-end",
          marginBottom: "6px",
          fontSize: "11px",
          fontWeight: 600,
          color: isToday ? ACCENT : "#7a7a88",
        }}
      >
        <span>{dayNum}</span>
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

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
