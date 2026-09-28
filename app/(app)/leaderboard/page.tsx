import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { MarketHeatmap } from "@/components/leaderboard/market-heatmap";
import { SetReleases } from "@/components/leaderboard/set-releases";
import { RELEASE_GAMES, getSetReleases } from "@/lib/tcg-releases";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLeaderboard, getMarketOverview, getTopTraders } from "@/lib/queries";
import { TopTraders } from "@/components/leaderboard/top-traders";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { LeaderboardMarket } from "@/components/leaderboard/leaderboard-market";

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [{ view }, user, t] = await Promise.all([searchParams, getCurrentUser(), getT()]);
  const [rows, releases, overview, traders] = await Promise.all([
    getLeaderboard(user.id), getSetReleases(), getMarketOverview(), getTopTraders(),
  ]);
  const defaultView = view === "heatmap" || view === "releases" || view === "traders" ? view : "table";

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("Leaderboard")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("Every card for sale right now, with its real price moves. Tap + to add one to your watchlist.")}
          </p>
        </div>
      </div>

      <Tabs defaultValue={defaultView}>
        <TabsList className="mb-4">
          <TabsTrigger value="table">{t("Table")}</TabsTrigger>
          <TabsTrigger value="traders">{t("Top traders")}</TabsTrigger>
          <TabsTrigger value="heatmap">{t("Heatmap")}</TabsTrigger>
          <TabsTrigger value="releases">{t("New set releases")}</TabsTrigger>
        </TabsList>
        <TabsContent value="table">
          <div className="flex flex-col gap-8">
            <LeaderboardMarket overview={overview} />
            <LeaderboardTable rows={rows} />
          </div>
        </TabsContent>
        <TabsContent value="traders">
          <TopTraders rows={traders} />
        </TabsContent>
        <TabsContent value="heatmap">
          <MarketHeatmap rows={rows} />
        </TabsContent>
        <TabsContent value="releases">
          <SetReleases
            upcoming={releases.upcoming}
            recent={releases.recent}
            unavailable={releases.unavailable}
            configured={releases.configured}
            today={releases.today ?? new Date().toISOString().slice(0, 10)}
            games={RELEASE_GAMES.map((g) => ({ slug: g.slug, label: g.label }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
