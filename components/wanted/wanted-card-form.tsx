"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellPlus, Loader2 } from "lucide-react";
import type { GradingCompany } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addWantedCard } from "@/lib/actions";

const ANY = "ANY";
const GRADES = ["10", "9.5", "9", "8", "7"];

export interface WantedCardDefaults {
  query?: string;
  gradingCompany?: GradingCompany | null;
  minGrade?: number | null;
  blackLabelOnly?: boolean;
}

/** Dialog for creating a "notify me when this card is listed" alert. */
export function WantedCardDialog({
  open,
  onOpenChange,
  defaults = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: WantedCardDefaults;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaults.query ?? "");
  const [company, setCompany] = useState<string>(defaults.gradingCompany ?? ANY);
  const [minGrade, setMinGrade] = useState<string>(defaults.minGrade != null ? String(defaults.minGrade) : ANY);
  const [blackLabelOnly, setBlackLabelOnly] = useState(Boolean(defaults.blackLabelOnly));
  const [maxPrice, setMaxPrice] = useState("");
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [pending, startTransition] = useTransition();

  const isRaw = company === "RAW";
  const gradeOptions = minGrade !== ANY && !GRADES.includes(minGrade) ? [minGrade, ...GRADES] : GRADES;

  function submit() {
    startTransition(async () => {
      try {
        await addWantedCard({
          query,
          gradingCompany: company === ANY ? null : (company as GradingCompany),
          minGrade: isRaw || minGrade === ANY ? null : Number(minGrade),
          blackLabelOnly: company === "BGS" && blackLabelOnly,
          maxPriceThb: maxPrice ? Number(maxPrice) : null,
          trustedOnly,
        });
        toast.success("Alert saved — we'll notify you when a match is listed.");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save alert.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notify me when listed</DialogTitle>
          <DialogDescription>
            Get a notification the moment a matching card goes on sale, whether it&apos;s a new listing or a relist.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="wanted-query">Card name contains</Label>
            <Input
              id="wanted-query"
              placeholder="e.g. Charizard"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Grading company</Label>
              <Select
                value={company}
                onValueChange={(v) => {
                  setCompany(v);
                  if (v !== "BGS") setBlackLabelOnly(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  <SelectItem value="PSA">PSA</SelectItem>
                  <SelectItem value="BGS">BGS (Beckett)</SelectItem>
                  <SelectItem value="CGC">CGC</SelectItem>
                  <SelectItem value="RAW">Raw / Ungraded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Minimum grade</Label>
              <Select value={isRaw ? ANY : minGrade} onValueChange={setMinGrade} disabled={isRaw}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {gradeOptions.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}+
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="wanted-max">Maximum price (THB, optional)</Label>
            <Input
              id="wanted-max"
              type="number"
              inputMode="numeric"
              placeholder="No limit"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
          {company === "BGS" && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={blackLabelOnly} onCheckedChange={(v) => setBlackLabelOnly(v === true)} />
              Black Label only
            </label>
          )}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={trustedOnly} onCheckedChange={(v) => setTrustedOnly(v === true)} />
            <span>
              Trusted sellers only
              <span className="text-muted-foreground block text-xs">ID-verified sellers, or 4+ star average rating</span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending || query.trim().length < 2 || (maxPrice !== "" && Number(maxPrice) < 100)}
          >
            {pending ? <Loader2 className="animate-spin" /> : <BellPlus />}
            Save Alert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A button that opens WantedCardDialog, pre-filled from the card being viewed. */
export function WantedCardButton({
  defaults,
  label = "Notify me when listed",
  className,
  variant = "outline",
}: {
  defaults?: WantedCardDefaults;
  label?: string;
  className?: string;
  variant?: "outline" | "secondary" | "default";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        <BellPlus /> {label}
      </Button>
      {open && <WantedCardDialog open={open} onOpenChange={setOpen} defaults={defaults} />}
    </>
  );
}
