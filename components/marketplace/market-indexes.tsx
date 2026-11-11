"use client";

import { GameIcon } from "@/components/ui/game-icon";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, ChevronRight, Loader2, Pencil, Plus } from "lucide-react";
import { Area, AreaChart, Tooltip, YAxis } from "recharts";

import { MyIndexEditor } from "@/components/marketplace/my-index-editor";
import { createUserIndex } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { LeaderboardRow } from "@/lib/queries";
import type { MarketIndex, MyIndex } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { ChangeTag } from "@/components/ui/change-tag";
import { useLanguage } from "@/components/landing/language-provider";

const NAMES: Record<MarketIndex["key"], string> = {
  ALL: "CardMart Index",
  POKEMON: "Pokémon Index",
  ONE_PIECE: "One Piece Index",
  MINE: "My Index",
};

// Each index opens its own page listing the cards inside it.
const HREF: Record<MarketIndex["key"], string> = {
  ALL: "/market/index/cardmart",
  POKEMON: "/market/index/pokemon",
  ONE_PIECE: "/market/index/one-piece",
  MINE: "/market/index/mine",
};

// Small tile for an index: the CardMart star, a Poké Ball, an anchor, or a bookmark for your own.
function IndexIcon({ index }: { index: MarketIndex["key"] }) {
  return (
    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center">
      {index === "ALL" ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny static logo
        // The app icon (outlined star on black), the same mark as the header and Compare page.
        <img src="/cardmart-icon.png" alt="" className="size-5 rounded-md object-cover" />
      ) : index === "MINE" ? (
        <Bookmark className="size-3.5 fill-current" />
      ) : (
        <GameIcon game={index} size={20} />
      )}
    </span>
  );
}

const formatLevel = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** The index's line is green when up and red when down, with a hover tooltip. */
function Sparkline({ index, className, tooltip = true }: { index: MarketIndex; className: string; tooltip?: boolean }) {
  const { locale, tr: t } = useLanguage();
  const first = index.points[0];
  const last = index.points.at(-1);
  const up = (last?.price ?? 0) >= (first?.price ?? 0);
  const config = { price: { label: t(NAMES[index.key]), color: up ? "var(--success)" : "var(--destructive)" } } satisfies ChartConfig;
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  // Unique per chart: several of your own indexes share the "MINE" key.
  const fillId = `indexFill-${useId().replace(/:/g, "")}`;

  return (
    <ChartContainer config={config} className={cn("aspect-auto", className)}>
      <AreaChart data={index.points} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-price)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--color-price)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        {tooltip && (
          <Tooltip
            cursor={{ strokeDasharray: "3 3", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active ? payload?.[0]?.payload : null;
              if (!p) return null;
              return (
                <div className="bg-background/95 rounded-md border px-2 py-1 shadow-lg">
                  <p className="text-muted-foreground text-[10px]">{new Date(p.t).toLocaleDateString(dateLocale)}</p>
                  <p className="text-sm font-semibold tabular-nums">{formatLevel(p.price)}</p>
                </div>
              );
            }}
          />
        )}
        <Area
          dataKey="price"
          type="monotone"
          stroke="var(--color-price)"
          strokeWidth={2}
          fill={`url(#${fillId})`}
          isAnimationActive={false}
          activeDot={tooltip ? { r: 4, strokeWidth: 2, fill: "var(--background)", stroke: "var(--color-price)" } : false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/** A neutral white glow under a card, with a soft hairline along its bottom edge. */
function Beam({ strong }: { strong?: boolean }) {
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "dark-only",
          "pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 transition-opacity duration-300",
          strong ? "opacity-100" : "opacity-70 group-hover:opacity-100",
        )}
        style={{ backgroundImage: "radial-gradient(70% 100% at 50% 100%, color-mix(in oklab, var(--foreground) 24%, transparent), transparent 75%)" }}
      />
      <div
        aria-hidden
        className="dark-only pointer-events-none absolute bottom-0 left-1/2 h-px w-3/5 -translate-x-1/2"
        style={{
          backgroundImage: "linear-gradient(90deg, transparent, var(--foreground), transparent)",
          boxShadow: "0 0 20px 2px color-mix(in oklab, var(--foreground) 40%, transparent)",
        }}
      />
    </>
  );
}

/** The glass card's frame: sheen, beam and hover lift. */
function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card hover:border-success/40 group relative isolate flex w-full flex-col justify-between gap-5 overflow-hidden rounded-3xl border px-5 pt-5 pb-7 transition-[border-color,transform] duration-300 has-[a:hover]:-translate-y-0.5">
      {/* Glass: a faint sheen falling from the top-left corner. */}
      <div
        aria-hidden
        className="dark-only pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: "linear-gradient(150deg, color-mix(in oklab, var(--foreground) 8%, transparent), transparent 42%)" }}
      />
      <Beam />
      {children}
    </div>
  );
}

function NamePill({ index, label, chevron = true }: { index: MarketIndex["key"]; label?: string; chevron?: boolean }) {
  const { tr: t } = useLanguage();
  return (
    <span className="bg-foreground/[0.05] flex min-w-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium">
      <IndexIcon index={index} />
      <span className="truncate">{label ?? t(NAMES[index])}</span>
      {chevron && <ChevronRight className="text-muted-foreground size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />}
    </span>
  );
}

/**
 * A glass card per index, lit from below. The whole card links to the index's
 * page; `action` sits above that link (the Edit button on your own index).
 */
function IndexCard({
  index,
  href = HREF[index.key],
  label,
  action,
}: {
  index: MarketIndex;
  href?: string;
  label?: string;
  action?: React.ReactNode;
}) {
  const { tr: t } = useLanguage();
  const last = index.points.at(-1);

  return (
    <CardShell>
      <Link href={href} aria-label={label ?? t(NAMES[index.key])} className="absolute inset-0 z-[1] rounded-3xl" />

      <div className="flex min-w-0 items-center justify-between gap-3">
        <NamePill index={index.key} label={label} />
        <span className="flex shrink-0 items-center gap-2">
          {action && <span className="relative z-[2]">{action}</span>}
          <ChangeTag pct={index.change1d} pill />
        </span>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <span className="text-[1.75rem] leading-none md:text-4xl font-semibold tracking-tight tabular-nums">{last ? formatLevel(last.price) : "—"}</span>
        </div>
        {index.points.length >= 2 ? (
          <Sparkline index={index} className="h-12 w-24 shrink-0 md:h-14 md:w-28" tooltip={false} />
        ) : (
          // Nothing to draw yet: a dashed baseline, so the card doesn't look broken.
          <svg aria-hidden viewBox="0 0 112 56" className="text-muted-foreground h-12 w-24 shrink-0 md:h-14 md:w-28">
            <path d="M2 30 H110" stroke="currentColor" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" opacity="0.45" />
          </svg>
        )}
      </div>
    </CardShell>
  );
}

/** Your own index: the cards you picked, with an Edit button; an invitation to build one when it's empty. */
function MyIndexCard({ mine, listings, autoOpen = false }: { mine: MyIndexCardData; listings: LeaderboardRow[]; autoOpen?: boolean }) {
  const { tr: t } = useLanguage();
  // A just-created index opens its editor straight away.
  const [editing, setEditing] = useState(autoOpen);
  const { id, name, index, cards } = mine;
  const label = name ?? undefined;
  const editor = <MyIndexEditor indexId={id} open={editing} onOpenChange={setEditing} name={name} cards={cards} listings={listings} />;

  if (cards.length === 0) {
    return (
      <CardShell>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <NamePill index="MINE" label={label} chevron={false} />
        </div>
        <div className="flex items-end justify-between gap-4">
          <p className="text-muted-foreground max-w-[16rem] text-sm">{t("Pick any cards and track them as your own index.")}</p>
          <Button size="sm" onClick={() => setEditing(true)} className="shrink-0">
            <Plus />
            {id ? t("Add cards") : t("Create")}
          </Button>
        </div>
        {editor}
      </CardShell>
    );
  }

  return (
    <>
      <IndexCard
        index={index}
        href={id ? `/market/index/mine-${id}` : HREF.MINE}
        label={label}
        action={
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t("Edit My Index")}
            title={t("Edit My Index")}
            className="bg-foreground/[0.05] hover:bg-foreground/10 text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-full border transition-colors"
          >
            <Pencil className="size-3.5" />
          </button>
        }
      />
      {editor}
    </>
  );
}

/** A dashed tile at the end of the row that starts another index of your own. */
function NewIndexCard({ onCreated }: { onCreated: (id: string) => void }) {
  const { tr: t } = useLanguage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      try {
        const { id } = await createUserIndex();
        onCreated(id);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not create an index."));
      }
    });
  }

  return (
    <button
      type="button"
      onClick={create}
      disabled={pending}
      className="text-muted-foreground hover:text-foreground hover:border-foreground/30 flex w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed px-5 py-10 text-sm font-medium transition-colors disabled:opacity-60"
    >
      <span className="bg-foreground/[0.05] flex size-9 items-center justify-center rounded-full border">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      </span>
      {t("New index")}
    </button>
  );
}

export type MyIndexCardData = Pick<MyIndex, "id" | "name" | "index" | "cards">;

/** Your watchlist index plus the extras allowed by USER_INDEX_MAX in lib/actions.ts. */
const MAX_OWN_INDEXES = 13;

/** Card widths in the desktop row: up to four across on wide screens (two on mid-size ones), more scroll sideways. */
function rowWidth(count: number) {
  if (count === 1) return "w-full";
  if (count === 2) return "w-[calc((100%-1rem)/2)]";
  if (count === 3) return "w-[calc((100%-2rem)/3)]";
  return "w-[calc((100%-1rem)/2)] xl:w-[calc((100%-3rem)/4)]";
}

/**
 * The indexes, like a stock market's headline indexes. Signed-in viewers also
 * get their own (`mine`: the watchlist one first, then any extras they built).
 */
export function MarketIndexes({
  indexes,
  mine = [],
  listings = [],
}: {
  indexes: MarketIndex[];
  mine?: MyIndexCardData[];
  listings?: LeaderboardRow[];
}) {
  const [justCreated, setJustCreated] = useState<string | null>(null);
  if (mine.length === 0 && indexes.every((i) => i.points.length === 0)) return null;
  // Offer another index once the first has cards, so an empty row doesn't show two invitations.
  const canAdd = mine.length > 0 && mine.length < MAX_OWN_INDEXES && (mine.length > 1 || mine[0].cards.length > 0);
  // The game indexes (Pokémon, One Piece) come first, then the all-market CardMart index, then your own indexes.
  const marketOrder = ["POKEMON", "ONE_PIECE", "ALL"];
  const rank = (key: string) => {
    const i = marketOrder.indexOf(key);
    return i === -1 ? marketOrder.length : i;
  };
  const cards = [
    ...[...indexes].sort((a, b) => rank(a.key) - rank(b.key)).map((index) => ({ key: index.key, node: <IndexCard index={index} /> })),
    ...mine.map((m) => ({
      key: m.id ?? "MINE",
      node: <MyIndexCard mine={m} listings={listings} autoOpen={m.id != null && m.id === justCreated} />,
    })),
    ...(canAdd ? [{ key: "NEW", node: <NewIndexCard onCreated={setJustCreated} /> }] : []),
  ];
  return (
    <>
      {/* Phones: the same glass cards as desktop, in a row you swipe through, with the next card peeking in. */}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {cards.map((c) => (
          <div key={c.key} className="flex w-[82%] shrink-0 snap-start">
            {c.node}
          </div>
        ))}
      </div>
      <section className="relative isolate hidden md:block">
        {/* The beams spill a little light onto the page under the cards. */}
        <div
          aria-hidden
          className="dark-only pointer-events-none absolute inset-x-[6%] -bottom-10 -z-10 h-36 blur-3xl"
          style={{ backgroundImage: "radial-gradient(60% 100% at 50% 100%, color-mix(in oklab, var(--foreground) 18%, transparent), transparent 70%)" }}
        />
        {/* A little room above and below so the hover lift isn't clipped by the scroll box. */}
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pt-1 pb-3 [scrollbar-width:thin]">
          {cards.map((c) => (
            <div key={c.key} className={cn("flex shrink-0 snap-start", rowWidth(cards.length))}>
              {c.node}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
