import "server-only";
import { unstable_cache } from "next/cache";

// Real set-release calendar from TCG API (https://tcgapi.dev), which mirrors
// TCGplayer's catalogue: every set with its official release date, including
// announced sets that haven't come out yet. GET /games/{slug}/sets returns
// sets newest-first, 50 per page, so page 1 covers upcoming sets plus
// roughly the last year of releases.
//
// Quota: the key allows 100 requests a day, shared with the item page's price
// lookups (lib/tcg-price.ts). Each game is cached for 12 hours and shared by
// every visitor (~4 calls/day for the 2 games). A failed request is never cached
// (the last good copy keeps being served), and after a failure we stop
// retrying that game for 30 minutes so an exhausted quota isn't hammered.

const TCG_API_BASE = "https://api.tcgapi.dev/v1";
const CACHE_SECONDS = 12 * 60 * 60;
const FAILURE_BACKOFF_MS = 30 * 60 * 1000;

export const RELEASE_GAMES = [
  { slug: "pokemon", label: "Pokémon" },
  { slug: "one-piece-card-game", label: "One Piece" },
] as const;

export type ReleaseGameSlug = (typeof RELEASE_GAMES)[number]["slug"];

export interface SetRelease {
  id: number;
  name: string;
  game: ReleaseGameSlug;
  gameLabel: string;
  releaseDate: string; // YYYY-MM-DD, as published by TCGplayer
  cardCount: number | null;
  imageUrl: string | null;
  iconUrl: string | null;
  tcgplayerUrl: string;
}

export function isReleaseFeedConfigured(): boolean {
  return Boolean(process.env.TCG_API_KEY);
}

const lastFailureAt = new Map<string, number>();

async function fetchGameSets(slug: ReleaseGameSlug): Promise<SetRelease[]> {
  const res = await fetch(`${TCG_API_BASE}/games/${slug}/sets`, {
    headers: { "X-API-Key": process.env.TCG_API_KEY! },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TCG API sets for ${slug}: HTTP ${res.status} ${(await res.text()).slice(0, 150)}`);
  }
  const body = await res.json();
  if (!Array.isArray(body?.data)) throw new Error(`TCG API sets for ${slug}: unexpected response`);
  const gameLabel = RELEASE_GAMES.find((g) => g.slug === slug)!.label;

  return (body.data as Record<string, unknown>[])
    .filter((s) => typeof s.name === "string" && typeof s.release_date === "string")
    .map((s) => ({
      id: Number(s.id),
      name: s.name as string,
      game: slug,
      gameLabel,
      releaseDate: (s.release_date as string).slice(0, 10),
      cardCount: typeof s.card_count === "number" ? s.card_count : null,
      imageUrl: typeof s.image_url === "string" ? s.image_url : null,
      iconUrl: typeof s.set_icon_url === "string" ? s.set_icon_url : null,
      tcgplayerUrl: `https://www.tcgplayer.com/search/all/product?${new URLSearchParams({ q: s.name as string })}`,
    }));
}

const cachedGameSets = unstable_cache(fetchGameSets, ["tcg-releases-v1"], { revalidate: CACHE_SECONDS });

async function getGameSets(slug: ReleaseGameSlug): Promise<{ sets: SetRelease[]; ok: boolean }> {
  const failedAt = lastFailureAt.get(slug);
  if (failedAt && Date.now() - failedAt < FAILURE_BACKOFF_MS) return { sets: [], ok: false };
  try {
    return { sets: await cachedGameSets(slug), ok: true };
  } catch (err) {
    lastFailureAt.set(slug, Date.now());
    console.warn("[tcg-releases]", err instanceof Error ? err.message : err);
    return { sets: [], ok: false };
  }
}

/**
 * Upcoming and recent set releases across the tracked games. `unavailable`
 * lists games whose data couldn't be loaded right now, so the page can say so
 * instead of quietly showing fewer sets.
 */
export async function getSetReleases(recentDays = 90) {
  if (!isReleaseFeedConfigured()) {
    return { upcoming: [], recent: [], unavailable: RELEASE_GAMES.map((g) => g.label), configured: false };
  }
  const results = await Promise.all(RELEASE_GAMES.map((g) => getGameSets(g.slug)));

  // Compare as YYYY-MM-DD strings in Thai time, since that's where the
  // marketplace is — a set out "today" in Bangkok counts as released.
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + 7 * 3_600_000 - recentDays * 86_400_000).toISOString().slice(0, 10);

  const all = results.flatMap((r) => r.sets);
  return {
    upcoming: all.filter((s) => s.releaseDate > today).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)),
    recent: all
      .filter((s) => s.releaseDate <= today && s.releaseDate >= cutoff)
      .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)),
    unavailable: RELEASE_GAMES.filter((_, i) => !results[i].ok).map((g) => g.label),
    configured: true,
    today,
  };
}
