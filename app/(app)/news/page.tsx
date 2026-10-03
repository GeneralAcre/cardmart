import { CommunityTabs } from "@/components/community/community-tabs";
import { MarketStats, RecentActivity } from "@/components/community/market-news";
import { SetReleases } from "@/components/community/set-releases";
import { getMarketOverview } from "@/lib/queries";
import { RELEASE_GAMES, getSetReleases } from "@/lib/tcg-releases";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

// Community → News: the market's headline figures, the latest activity on
// CardMart, and new set releases for the games we trade.
export default async function NewsPage() {
  await getCurrentUser();
  const [overview, releases, t] = await Promise.all([getMarketOverview(), getSetReleases(), getT()]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="eyebrow text-foreground text-sm">{t("News")}</h1>
          <p className="text-muted-foreground text-sm">{t("What's moving on CardMart, and the new sets on the way.")}</p>
        </div>
        <CommunityTabs />
      </div>

      <div className="flex flex-col gap-6">
        <MarketStats overview={overview} />
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-w-0 flex-col gap-4">
            <h2 className="eyebrow text-foreground text-sm">{t("New set releases")}</h2>
            <SetReleases
              upcoming={releases.upcoming}
              recent={releases.recent}
              unavailable={releases.unavailable}
              configured={releases.configured}
              today={releases.today ?? new Date().toISOString().slice(0, 10)}
              games={RELEASE_GAMES.map((g) => ({ slug: g.slug, label: g.label }))}
            />
          </section>
          <div className="lg:sticky lg:top-24">
            <RecentActivity updates={overview.updates} />
          </div>
        </div>
      </div>
    </div>
  );
}
