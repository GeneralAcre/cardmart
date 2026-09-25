import Link from "next/link";

import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { getLeaderboard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  const rows = await getLeaderboard(user.id);

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
      <LeaderboardTable rows={rows} />
    </div>
  );
}
