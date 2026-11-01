"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMoney } from "@/components/currency-provider";
import { useT } from "@/components/landing/language-provider";
import { deleteUserIndex, renameMyIndex, renameUserIndex, toggleUserIndexCard, toggleWatchlist } from "@/lib/actions";
import { formatGrade } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/queries";
import type { PickedCard } from "@/lib/stats";

const SEARCH_RESULTS = 20;
/** Matches the cap in renameMyIndex (lib/actions.ts). */
const MY_INDEX_NAME_MAX = 32;

type Row = Pick<PickedCard, "id" | "name" | "gradingCompany" | "grade" | "isBlackLabel" | "priceThb"> & { priced?: boolean };

/**
 * Pick the cards in your own index. An empty search lists what's in it now;
 * typing searches live listings. The first index's picks are the viewer's
 * watchlist, so a bookmark on a card page adds it there too; extra indexes
 * (`indexId`) keep their own.
 */
export function MyIndexEditor({
  indexId,
  open,
  onOpenChange,
  name,
  cards,
  listings,
}: {
  indexId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string | null;
  cards: PickedCard[];
  listings: LeaderboardRow[];
}) {
  const t = useT();
  const money = useMoney();
  const router = useRouter();
  const [draftName, setDraftName] = useState(name ?? "");
  const [savedName, setSavedName] = useState(name);
  const [savingName, setSavingName] = useState(false);
  // The name being saved right now, so a blur and the dialog closing don't send it twice.
  const inFlightName = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => new Set(cards.map((c) => c.id)));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const rows: Row[] = q ? listings.filter((r) => r.name.toLowerCase().includes(q)).slice(0, SEARCH_RESULTS) : cards;

  function saveName() {
    const next = draftName.trim();
    if (next === (savedName ?? "") || next === inFlightName.current) return;
    inFlightName.current = next;
    setSavingName(true);
    startTransition(async () => {
      try {
        const res = indexId ? await renameUserIndex(indexId, next) : await renameMyIndex(next);
        setSavedName(res.name);
        setDraftName(res.name ?? "");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not rename your index."));
      } finally {
        setSavingName(false);
        inFlightName.current = null;
      }
    });
  }

  function toggle(id: string) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = indexId ? await toggleUserIndexCard(indexId, id) : await toggleWatchlist(id);
        setPicked((prev) => {
          const next = new Set(prev);
          if (res.watching) next.add(id);
          else next.delete(id);
          return next;
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not update watchlist."));
      } finally {
        setBusyId(null);
      }
    });
  }

  function remove() {
    if (!indexId || !window.confirm(t("Delete this index?"))) return;
    setDeleting(true);
    startTransition(async () => {
      try {
        await deleteUserIndex(indexId);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not delete your index."));
      } finally {
        setDeleting(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setPicked(new Set(cards.map((c) => c.id)));
          setSavedName(name);
          setDraftName(name ?? "");
        } else {
          saveName();
          setQuery("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">{savedName ?? t("My Index")}</DialogTitle>
          <DialogDescription>
            {t("Pick the cards to track. Your index moves with their market prices, each card weighted equally.")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="my-index-name">{t("Name")}</Label>
          <div className="relative">
            <Input
              id="my-index-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveName();
                }
              }}
              placeholder={t("My Index")}
              maxLength={MY_INDEX_NAME_MAX}
              className="pr-9"
            />
            {savingName && <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />}
          </div>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search cards")} className="pl-9" />
        </div>
        <ul className="-mx-2 flex max-h-80 flex-col overflow-y-auto">
          {rows.length === 0 ? (
            <li className="text-muted-foreground px-2 py-8 text-center text-sm">
              {q ? t("No listed cards match.") : t("Search for a card to add it to your index.")}
            </li>
          ) : (
            rows.map((card) => {
              const on = picked.has(card.id);
              const grade = card.gradingCompany === "RAW" ? t("Raw") : `${card.gradingCompany} ${formatGrade(card.grade)}${card.isBlackLabel ? " BL" : ""}`;
              return (
                <li key={card.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{card.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {grade} · <span className="tabular-nums">{card.priceThb != null ? money(card.priceThb) : t("Not for sale")}</span>
                      {card.priced === false && ` · ${t("No market price yet")}`}
                    </span>
                  </span>
                  <Button
                    size="icon"
                    variant={on ? "secondary" : "outline"}
                    onClick={() => toggle(card.id)}
                    disabled={busyId != null}
                    aria-label={on ? t("Remove from index") : t("Add to index")}
                    title={on ? t("Remove from index") : t("Add to index")}
                  >
                    {busyId === card.id ? <Loader2 className="animate-spin" /> : on ? <Check /> : <Plus />}
                  </Button>
                </li>
              );
            })
          )}
        </ul>
        {indexId && (
          <Button variant="ghost" onClick={remove} disabled={deleting} className="text-destructive hover:text-destructive self-start">
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {t("Delete index")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
