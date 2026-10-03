import { CommunityTabs } from "@/components/community/community-tabs";
import { TopTraders } from "@/components/leaderboard/top-traders";
import { getTopTraders } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

// Community → Leaderboard: the trader ranking only. Market movers and the
// heatmap are on the Market page; stats, activity and releases are in News.
export default async function LeaderboardPage() {
  await getCurrentUser();
  const [traders, t] = await Promise.all([getTopTraders(), getT()]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="eyebrow text-foreground text-sm">{t("Leaderboard")}</h1>
          <p className="text-muted-foreground text-sm">{t("Top traders on CardMart, ranked by their gains.")}</p>
        </div>
        <CommunityTabs />
      </div>
      <TopTraders rows={traders} />
    </div>
  );
}
