import Link from "next/link";

import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { MarketHeatmap } from "@/components/leaderboard/market-heatmap";
import { SetReleases } from "@/components/leaderboard/set-releases";
import { RELEASE_GAMES, getSetReleases } from "@/lib/tcg-releases";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLeaderboard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [{ view }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const [rows, releases] = await Promise.all([getLeaderboard(user.id), getSetReleases()]);
  const defaultView = view === "heatmap" || view === "releases" ? view : "table";

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Leaderboard</h1>
          <p className="text-muted-foreground text-sm">
            Every card for sale right now, with its real price moves. Tap + to add one to your watchlist.
          </p>
        </div>
        <Link href="/market" className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2">
          Rankings by grade &amp; market stats
        </Link>
      </div>

      <Tabs defaultValue={defaultView}>
        <TabsList className="mb-4">
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="releases">New set releases</TabsTrigger>
        </TabsList>
        <TabsContent value="table">
          <LeaderboardTable rows={rows} />
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
