import type { Metadata } from "next";
import { PageHeader } from "@/components/app/section";
import { CalendarBoard } from "@/components/app/calendar/calendar-board";
import { requireOnboardedUser } from "@/lib/auth/session";
import { reconcileQuietly } from "@/lib/data/home";
import { listCalendarPosts, listPosts } from "@/lib/data/posts";
import { addDaysToKey, dateKey, isMonthKey, monthGrid, safeTimeZone, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; view?: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const params = await searchParams;
  const tz = safeTimeZone(profile.timezone);
  const today = dateKey(new Date(), tz);
  const month = isMonthKey(params.month) ? params.month : today.slice(0, 7);
  const view = params.view === "agenda" ? "agenda" : "month";

  await reconcileQuietly(user.id);
  const grid = monthGrid(month);
  const from = zonedToUtc(grid[0].key, "00:00", tz).toISOString();
  const to = zonedToUtc(addDaysToKey(grid[grid.length - 1].key, 1), "00:00", tz).toISOString();

  const [posts, tray] = await Promise.all([
    listCalendarPosts(user.id, from, to),
    listPosts(user.id, { statuses: ["approved"], limit: 20, order: "updated" }),
  ]);

  return (
    <>
      <PageHeader title="Calendar" description="Everything scheduled and published, in your timezone." />
      <CalendarBoard
        key={`${month}-${view}`}
        month={month}
        view={view}
        posts={posts}
        tray={tray}
        timezone={tz}
        businessName={profile.business_name ?? profile.name ?? "Your business"}
        today={today}
      />
    </>
  );
}
