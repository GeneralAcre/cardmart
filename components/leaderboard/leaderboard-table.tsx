"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Plus, Search } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { Input } from "@/components/ui/input";
import { toggleWatchlist } from "@/lib/actions";
import { formatDate, formatGrade, formatThb } from "@/lib/format";
import type { LeaderboardPeriod, LeaderboardRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Tab = "all" | "gainers" | "losers" | "new" | "watched";
type SortKey = "price" | "change" | "sales" | "watchers";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All cards" },
  { key: "gainers", label: "Top gainers" },
  { key: "losers", label: "Top losers" },
  { key: "new", label: "New drops" },
  { key: "watched", label: "Most watched" },
];
const PERIODS: LeaderboardPeriod[] = ["24h", "7d", "30d"];
const NEW_DROP_DAYS = 30;
const MAX_ROWS = 50;

function gradeSymbol(r: LeaderboardRow) {
  if (r.gradingCompany === "RAW") return "RAW";
  return `${r.gradingCompany} ${formatGrade(r.grade)}${r.isBlackLabel ? " BL" : ""}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatDate(d);
}

function Change({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const up = value > 0;
  const flat = Math.abs(value) < 0.005;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 tabular-nums",
        flat ? "text-muted-foreground" : up ? "text-success" : "text-destructive",
      )}
    >
      {!flat && <span className="text-[10px] leading-none">{up ? "▲" : "▼"}</span>}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [period, setPeriod] = useState<LeaderboardPeriod>("7d");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? rows.filter((r) => `${r.name} ${r.subtitle} ${gradeSymbol(r)}`.toLowerCase().includes(q))
      : [...rows];
    const ch = (r: LeaderboardRow) => r.change[period];

    if (tab === "gainers") list = list.filter((r) => (ch(r) ?? 0) > 0).sort((a, b) => ch(b)! - ch(a)!);
    else if (tab === "losers") list = list.filter((r) => (ch(r) ?? 0) < 0).sort((a, b) => ch(a)! - ch(b)!);
    else if (tab === "new") {
      list = list.filter((r) => r.isNewDrop).sort((a, b) => b.listedAt.localeCompare(a.listedAt));
    } else if (tab === "watched") list = list.filter((r) => r.watchers > 0).sort((a, b) => b.watchers - a.watchers);
    else list.sort((a, b) => b.priceThb - a.priceThb);

    if (sort) {
      const value = (r: LeaderboardRow) =>
        sort.key === "price" ? r.priceThb : sort.key === "change" ? (ch(r) ?? -Infinity) : sort.key === "sales" ? r.sales30d : r.watchers;
      list.sort((a, b) => (sort.dir === "asc" ? value(a) - value(b) : value(b) - value(a)));
    }
    return list.slice(0, MAX_ROWS);
  }, [rows, tab, period, query, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev?.key === key ? (prev.dir === "desc" ? { key, dir: "asc" } : null) : { key, dir: "desc" }));
  }

  // New drops are grouped under a day heading ("Today", "Yesterday", date) —
  // like a release calendar — but only while the list is in date order.
  const groupByDay = tab === "new" && !sort;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setSort(null);
              }}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === t.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards"
              className="h-9 pl-8"
              aria-label="Search cards"
            />
          </div>
          <div className="bg-muted flex shrink-0 rounded-lg p-0.5 text-xs font-medium">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={cn(
                  "rounded-md px-2.5 py-1.5 transition-colors",
                  period === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[340px] text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs font-normal">
              <th className="w-8 py-3 pr-2 font-normal">#</th>
              <th className="py-3 pr-4 font-normal">Name</th>
              <th className="hidden py-3 pr-4 font-normal md:table-cell">Grade</th>
              <SortHeader label="Price" sortKey="price" sort={sort} onSort={toggleSort} />
              <SortHeader label={period === "24h" ? "Today" : period} sortKey="change" sort={sort} onSort={toggleSort} />
              <SortHeader label="Sales 30d" sortKey="sales" sort={sort} onSort={toggleSort} className="hidden lg:table-cell" />
              <SortHeader label="Watchers" sortKey="watchers" sort={sort} onSort={toggleSort} className="hidden sm:table-cell" />
              <th className="w-10 py-3 font-normal" aria-label="Watch" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-muted-foreground py-16 text-center">
                  {tab === "gainers"
                    ? `No price gains in the last ${period}.`
                    : tab === "losers"
                      ? `No price drops in the last ${period}.`
                      : tab === "new"
                        ? `Nothing new listed in the last ${NEW_DROP_DAYS} days.`
                        : tab === "watched"
                          ? "No cards are on anyone's watchlist yet."
                          : "No cards match your search."}
                </td>
              </tr>
            ) : (
              visible.map((r, i) => {
                const heading = groupByDay && (i === 0 || dayLabel(visible[i - 1].listedAt) !== dayLabel(r.listedAt));
                return (
                  <LeaderboardRowView
                    key={r.id}
                    row={r}
                    rank={i + 1}
                    period={period}
                    dayHeading={heading ? dayLabel(r.listedAt) : null}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-[11px]">
        Change compares each card&apos;s asking price with its price at the start of the period. &ldquo;—&rdquo; means
        the card wasn&apos;t listed yet. Sales count completed escrow sales of the same card and grade. Shows the
        top {MAX_ROWS} cards for each tab.
      </p>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className={cn("py-3 pr-4 font-normal", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
      >
        {label}
        {active && (sort!.dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </th>
  );
}

function LeaderboardRowView({
  row,
  rank,
  period,
  dayHeading,
}: {
  row: LeaderboardRow;
  rank: number;
  period: LeaderboardPeriod;
  dayHeading: string | null;
}) {
  const router = useRouter();
  const [watching, setWatching] = useState(row.watchedByViewer);
  const [pending, startTransition] = useTransition();

  function toggleWatch() {
    startTransition(async () => {
      try {
        const res = await toggleWatchlist(row.id);
        setWatching(res.watching);
        toast.success(res.watching ? `${row.name} added to your watchlist` : "Removed from watchlist");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update watchlist.");
      }
    });
  }

  return (
    <>
      {dayHeading && (
        <tr>
          <td colSpan={8} className="pt-6 pb-2 text-xs font-semibold tracking-wide uppercase">
            {dayHeading}
          </td>
        </tr>
      )}
      <tr className="hover:bg-accent/50 border-b transition-colors">
        <td className="text-muted-foreground py-3.5 pr-2 tabular-nums">{rank}</td>
        <td className="py-3.5 pr-4">
          <Link href={`/item/${row.id}`} className="flex min-w-0 items-center gap-3">
            <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-md border sm:w-14">
              {row.photoUrl ? (
                <Image src={row.photoUrl} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <CardArt
                  themeIndex={row.themeIndex}
                  category={row.category}
                  gradingCompany={row.gradingCompany}
                  grade={row.grade}
                  isBlackLabel={row.isBlackLabel}
                  bordered={false}
                />
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold hover:underline">{row.name}</span>
              <span className="text-muted-foreground truncate text-xs">
                <span className="md:hidden">{gradeSymbol(row)} · </span>
                {row.subtitle}
              </span>
            </div>
          </Link>
        </td>
        <td className="hidden py-3.5 pr-4 whitespace-nowrap md:table-cell">{gradeSymbol(row)}</td>
        <td className="py-3.5 pr-4 font-medium whitespace-nowrap tabular-nums">{formatThb(row.priceThb)}</td>
        <td className="py-3.5 pr-4 whitespace-nowrap">
          <Change value={row.change[period]} />
        </td>
        <td className="hidden py-3.5 pr-4 tabular-nums lg:table-cell">{row.sales30d}</td>
        <td className="hidden py-3.5 pr-4 tabular-nums sm:table-cell">{row.watchers}</td>
        <td className="py-3.5 text-right">
          <button
            type="button"
            onClick={toggleWatch}
            disabled={pending}
            aria-label={watching ? `Remove ${row.name} from watchlist` : `Add ${row.name} to watchlist`}
            title={watching ? "On your watchlist" : "Add to watchlist"}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-full transition-colors disabled:opacity-50",
              watching ? "text-success" : "hover:bg-accent",
            )}
          >
            {watching ? <Check className="size-4" /> : <Plus className="size-4" />}
          </button>
        </td>
      </tr>
    </>
  );
}
