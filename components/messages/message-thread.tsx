"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { Check, CheckCheck, HandCoins, ImagePlus, Layers, Loader2, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { markConversationRead, respondToOffer, sendMessage, sendOfferInChat, withdrawOffer } from "@/lib/actions";
import { formatGrade, formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

export interface ChatAsset {
  id: string;
  name: string;
  subtitle: string;
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
  priceThb: number | null;
  forSale: boolean;
  ownerId: string;
  imageUrl: string | null;
}

export interface ThreadMessage {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
  imageUrls: string[];
  asset: ChatAsset | null;
  offer: { id: string; amountThb: number; status: string; buyerId: string; sellerId: string; assetId: string } | null;
}

// No websocket infra in this project, so new replies arrive by re-fetching
// the server component every few seconds while the tab is visible — cheap,
// and plenty for a two-person chat.
const POLL_INTERVAL_MS = 5000;
const MAX_PHOTOS = 4;
// Photos are scaled down before upload: plenty to judge a card's corners,
// far smaller than a phone's original.
const MAX_PHOTO_EDGE = 1600;

function gradeOf(a: Pick<ChatAsset, "gradingCompany" | "grade" | "isBlackLabel">, raw: string) {
  return a.gradingCompany === "RAW" ? raw : `${a.gradingCompany} ${formatGrade(a.grade)}${a.isBlackLabel ? " BL" : ""}`;
}

/** Scales an image file down to MAX_PHOTO_EDGE and re-encodes it as JPEG. */
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read that photo."))), "image/jpeg", 0.85),
  );
}

function dayLabel(iso: string, locale: string, today: string, yesterday: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return today;
  if (sameDay(d, new Date(now.getTime() - 86_400_000))) return yesterday;
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** A small card tile: image, name, grade and price, linking to the listing. */
function CardChip({ asset, className }: { asset: ChatAsset; className?: string }) {
  const { tr: t } = useLanguage();
  return (
    <Link
      href={`/item/${asset.id}`}
      className={cn("bg-background/60 hover:bg-background flex items-center gap-3 rounded-xl border p-2 transition-colors", className)}
    >
      <div className="bg-muted relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-md">
        {asset.imageUrl && <Image src={asset.imageUrl} alt={asset.name} fill sizes="40px" className="object-cover" />}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">{asset.name}</span>
        <span className="text-muted-foreground truncate text-xs">
          {gradeOf(asset, t("Raw"))} · {asset.priceThb != null && asset.forSale ? formatThb(asset.priceThb) : t("Not for sale")}
        </span>
      </div>
    </Link>
  );
}

const OFFER_STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Waiting for reply", className: "bg-amber-400/15 text-amber-400" },
  ACCEPTED: { label: "Accepted", className: "bg-success/15 text-success" },
  REJECTED: { label: "Declined", className: "bg-destructive/15 text-destructive" },
  WITHDRAWN: { label: "Withdrawn", className: "bg-muted text-muted-foreground" },
};

/** An offer in the chat: the amount against the asking price, its live status and what each side can do. */
function OfferCard({ message, currentUserId }: { message: ThreadMessage; currentUserId: string }) {
  const router = useRouter();
  const { tr: t } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const offer = message.offer!;
  const asset = message.asset;
  const status = OFFER_STATUS[offer.status] ?? OFFER_STATUS.WITHDRAWN;
  const asking = asset?.priceThb ?? null;
  const pctUnder = asking ? Math.round(((asking - offer.amountThb) / asking) * 100) : null;
  const isSeller = offer.sellerId === currentUserId;
  const isBuyer = offer.buyerId === currentUserId;

  async function act(kind: string, fn: () => Promise<unknown>, done: string) {
    setBusy(kind);
    try {
      await fn();
      toast.success(t(done));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Something went wrong. Try again."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-card w-72 max-w-full overflow-hidden rounded-2xl border">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <HandCoins className="size-3.5" /> {t("Offer")}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", status.className)}>{t(status.label)}</span>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tabular-nums">{formatThb(offer.amountThb)}</span>
          {pctUnder != null && pctUnder !== 0 && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {pctUnder > 0
                ? t("{pct}% under asking", { pct: pctUnder })
                : t("{pct}% over asking", { pct: -pctUnder })}
            </span>
          )}
        </div>
        {asset && <CardChip asset={asset} />}
        {offer.status === "PENDING" && isSeller && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={busy !== null}
              onClick={() => act("accept", () => respondToOffer(offer.id, "accept"), "Offer accepted.")}
            >
              {busy === "accept" ? <Loader2 className="animate-spin" /> : <Check />} {t("Accept")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={busy !== null}
              onClick={() => act("reject", () => respondToOffer(offer.id, "reject"), "Offer declined.")}
            >
              {busy === "reject" ? <Loader2 className="animate-spin" /> : <X />} {t("Decline")}
            </Button>
          </div>
        )}
        {offer.status === "PENDING" && isBuyer && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => act("withdraw", () => withdrawOffer(offer.id), "Offer withdrawn.")}
          >
            {busy === "withdraw" && <Loader2 className="animate-spin" />} {t("Withdraw offer")}
          </Button>
        )}
        {offer.status === "ACCEPTED" && isBuyer && (
          <Button size="sm" asChild>
            <Link href={`/item/${offer.assetId}`}>{t("Complete purchase")}</Link>
          </Button>
        )}
        {offer.status === "ACCEPTED" && isSeller && (
          <p className="text-muted-foreground text-xs">{t("Waiting for the buyer to pay into escrow.")}</p>
        )}
      </div>
    </div>
  );
}

/** Picks one card from a list — for attaching a card or choosing what to make an offer on. */
function CardPicker({
  groups,
  selectedId,
  onPick,
}: {
  groups: { label: string; cards: ChatAsset[] }[];
  selectedId?: string | null;
  onPick: (card: ChatAsset) => void;
}) {
  const { tr: t } = useLanguage();
  return (
    <div className="flex max-h-80 flex-col gap-4 overflow-y-auto">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{g.label}</span>
          {g.cards.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("No cards for sale.")}</p>
          ) : (
            g.cards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => onPick(card)}
                className={cn(
                  "hover:bg-muted/60 flex items-center gap-3 rounded-xl border p-2 text-left transition-colors",
                  selectedId === card.id && "border-foreground/60 bg-muted/60",
                )}
              >
                <div className="bg-muted relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-md">
                  {card.imageUrl && <Image src={card.imageUrl} alt={card.name} fill sizes="40px" className="object-cover" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{card.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {gradeOf(card, t("Raw"))} · {card.subtitle}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {card.priceThb != null ? formatThb(card.priceThb) : "—"}
                </span>
              </button>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

/** Make an offer on one of the other person's cards, from inside the chat. */
function OfferDialog({
  open,
  onOpenChange,
  conversationId,
  theirListings,
  initialAssetId,
  otherName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  theirListings: ChatAsset[];
  initialAssetId: string | null;
  otherName: string;
}) {
  const router = useRouter();
  const { tr: t } = useLanguage();
  const [assetId, setAssetId] = useState<string | null>(initialAssetId ?? theirListings[0]?.id ?? null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const card = theirListings.find((c) => c.id === assetId) ?? null;
  const asking = card?.priceThb ?? null;
  const value = Number(amount.replace(/[^\d]/g, ""));

  function submit() {
    if (!card || !value) return;
    startTransition(async () => {
      try {
        await sendOfferInChat(conversationId, card.id, value, note);
        toast.success(t("Offer sent."));
        setAmount("");
        setNote("");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not send the offer."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Make an offer")}</DialogTitle>
          <DialogDescription>
            {t("{name} can accept or decline it here. If they accept, you pay through escrow like any purchase.", { name: otherName })}
          </DialogDescription>
        </DialogHeader>
        <CardPicker groups={[{ label: t("Their cards"), cards: theirListings }]} selectedId={assetId} onPick={(c) => setAssetId(c.id)} />
        {card && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="offer-amount">
              {t("Your offer")}
            </label>
            <div className="relative">
              <Input
                id="offer-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={asking ? asking.toLocaleString() : "0"}
                className="h-11 pr-12 text-lg font-semibold tabular-nums"
              />
              <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">THB</span>
            </div>
            {asking != null && (
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setAmount(String(Math.floor((asking * (100 - pct)) / 100 / 100) * 100))}
                    className="hover:bg-muted rounded-full border px-3 py-1 text-xs font-medium tabular-nums"
                  >
                    −{pct}% · {formatThb(Math.floor((asking * (100 - pct)) / 100 / 100) * 100)}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("Add a note (optional)")}
              rows={2}
              maxLength={500}
              className="resize-none"
            />
            <Button onClick={submit} disabled={pending || !value || value < 100}>
              {pending ? <Loader2 className="animate-spin" /> : <HandCoins />}
              {value ? t("Offer {amount}", { amount: formatThb(value) }) : t("Enter an amount")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MessageThread({
  conversationId,
  currentUserId,
  otherName,
  messages,
  theirListings,
  myListings,
  initialAssetId,
}: {
  conversationId: string;
  currentUserId: string;
  otherName: string;
  messages: ThreadMessage[];
  theirListings: ChatAsset[];
  myListings: ChatAsset[];
  // Set when the chat was opened from a listing ("Message Seller").
  initialAssetId: string | null;
}) {
  const router = useRouter();
  const { locale, tr: t } = useLanguage();
  const [draft, setDraft] = useState("");
  const [photos, setPhotos] = useState<{ id: string; preview: string; url: string | null }[]>([]);
  const [attached, setAttached] = useState<ChatAsset | null>(
    () => [...theirListings, ...myListings].find((c) => c.id === initialAssetId) ?? null,
  );
  const [picking, setPicking] = useState(false);
  const [offering, setOffering] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dateLocale = locale === "th" ? "th-TH" : "en-US";

  const lastIncomingId = [...messages].reverse().find((m) => m.senderId !== currentUserId)?.id;
  const lastMine = [...messages].reverse().find((m) => m.senderId === currentUserId);

  // Mark read on open and whenever a new incoming message lands, then
  // refresh so the header's unread badge drops too.
  useEffect(() => {
    if (!lastIncomingId) return;
    void markConversationRead(conversationId).then(() => router.refresh());
  }, [conversationId, lastIncomingId, router]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(t("Up to {count} photos per message.", { count: MAX_PHOTOS }));
      return;
    }
    const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    const added = picked.map((file) => ({ id: crypto.randomUUID(), preview: URL.createObjectURL(file), url: null, file }));
    setPhotos((prev) => [...prev, ...added.map(({ id, preview, url }) => ({ id, preview, url }))]);
    await Promise.all(
      added.map(async ({ id, file, preview }) => {
        try {
          const blob = await shrinkPhoto(file);
          const result = await upload(`chat/${Date.now()}.jpg`, blob, { access: "public", handleUploadUrl: "/api/blob/upload" });
          setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, url: result.url } : p)));
        } catch {
          toast.error(t("A photo didn't upload. Try again."));
          URL.revokeObjectURL(preview);
          setPhotos((prev) => prev.filter((p) => p.id !== id));
        }
      }),
    );
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  const uploading = photos.some((p) => !p.url);
  const canSend = !pending && !uploading && (draft.trim() !== "" || photos.length > 0 || attached !== null);

  function submit() {
    if (!canSend) return;
    const body = draft.trim();
    startTransition(async () => {
      try {
        await sendMessage(conversationId, body, { imageUrls: photos.map((p) => p.url!), assetId: attached?.id ?? null });
        setDraft("");
        photos.forEach((p) => URL.revokeObjectURL(p.preview));
        setPhotos([]);
        setAttached(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not send message."));
      }
    });
  }

  // A divider where the day changes, and the time once per run of messages
  // from the same person.
  const days = messages.map((m) => dayLabel(m.createdAt, dateLocale, t("Today"), t("Yesterday")));
  const rows = messages.map((m, i) => ({
    m,
    day: days[i],
    showDay: i === 0 || days[i] !== days[i - 1],
    endOfRun: i === messages.length - 1 || messages[i + 1].senderId !== m.senderId || days[i + 1] !== days[i],
  }));

  return (
    <div className="bg-card flex min-h-[70vh] flex-1 flex-col overflow-hidden rounded-2xl border">
      <div className="flex max-h-[68vh] flex-1 flex-col gap-1.5 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="m-auto flex max-w-sm flex-col items-center gap-3 text-center">
            <p className="text-muted-foreground text-sm">
              {t("Say hello — ask about the item's condition, shipping, or whether they'd take a lower price.")}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[t("Is this still available?"), t("Can you send more photos of the corners?"), t("Would you take a lower price?")].map((q) => (
                <button key={q} type="button" onClick={() => setDraft(q)} className="hover:bg-muted rounded-full border px-3 py-1.5 text-xs">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          rows.map(({ m, day, showDay, endOfRun }) => {
            const mine = m.senderId === currentUserId;
            return (
              <div key={m.id} className="flex flex-col gap-1.5">
                {showDay && (
                  <div className="text-muted-foreground my-2 flex items-center gap-3 text-[11px] font-medium">
                    <span className="bg-border h-px flex-1" />
                    {day}
                    <span className="bg-border h-px flex-1" />
                  </div>
                )}
                <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                  {m.offer ? (
                    <OfferCard message={m} currentUserId={currentUserId} />
                  ) : (
                    <>
                      {m.imageUrls.length > 0 && (
                        <div className={cn("grid max-w-[80%] gap-1", m.imageUrls.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                          {m.imageUrls.map((url) => (
                            <button
                              key={url}
                              type="button"
                              onClick={() => setViewer(url)}
                              className="bg-muted relative size-40 overflow-hidden rounded-xl sm:size-48"
                            >
                              <Image src={url} alt={t("Photo")} fill sizes="192px" className="object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                      {m.asset && <CardChip asset={m.asset} className="w-72 max-w-[80%]" />}
                      {m.body && (
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap",
                            mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm",
                          )}
                        >
                          {m.body}
                        </div>
                      )}
                    </>
                  )}
                  {endOfRun && (
                    <span className="text-muted-foreground flex items-center gap-1 px-1 text-[10px]">
                      {new Date(m.createdAt).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                      {mine && m.id === lastMine?.id && (
                        <>
                          {" · "}
                          {m.readAt ? <CheckCheck className="text-success size-3" /> : <Check className="size-3" />}
                          {m.readAt ? t("Seen") : t("Sent")}
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer: what's attached, then the tools and the text box. */}
      <div className="flex flex-col gap-2 border-t p-3">
        {(attached || photos.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {attached && (
              <div className="relative">
                <CardChip asset={attached} className="w-64 pr-8" />
                <button
                  type="button"
                  onClick={() => setAttached(null)}
                  aria-label={t("Remove")}
                  className="bg-background absolute top-1.5 right-1.5 rounded-full border p-0.5"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            {photos.map((p) => (
              <div key={p.id} className="bg-muted relative size-16 overflow-hidden rounded-lg">
                {/* A local preview (blob: URL), so a plain img rather than next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="size-full object-cover" />
                {!p.url && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="size-4 animate-spin text-white" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  aria-label={t("Remove")}
                  className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex shrink-0 gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void addPhotos(e.target.files);
                e.target.value = "";
              }}
            />
            <Button type="button" size="icon" variant="ghost" onClick={() => fileRef.current?.click()} aria-label={t("Add photos")} title={t("Add photos")}>
              <ImagePlus />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => setPicking(true)} aria-label={t("Attach a card")} title={t("Attach a card")}>
              <Layers />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setOffering(true)}
              disabled={theirListings.length === 0}
              aria-label={t("Make an offer")}
              title={theirListings.length === 0 ? t("They have no cards for sale.") : t("Make an offer")}
            >
              <HandCoins />
            </Button>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter adds a new line.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            onPaste={(e) => {
              // Pasting a screenshot attaches it as a photo.
              if (e.clipboardData.files.length) {
                e.preventDefault();
                void addPhotos(e.clipboardData.files);
              }
            }}
            placeholder={t("Write a message…")}
            rows={1}
            maxLength={2000}
            className="max-h-32 min-h-10 resize-none"
            disabled={pending}
          />
          <Button type="submit" size="icon" disabled={!canSend} aria-label={t("Send")}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Attach a card")}</DialogTitle>
            <DialogDescription>{t("Share a listing so you're both talking about the same card.")}</DialogDescription>
          </DialogHeader>
          <CardPicker
            groups={[
              { label: t("Their cards"), cards: theirListings },
              { label: t("Your cards"), cards: myListings },
            ]}
            selectedId={attached?.id}
            onPick={(card) => {
              setAttached(card);
              setPicking(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <OfferDialog
        key={attached?.id ?? "none"}
        open={offering}
        onOpenChange={setOffering}
        conversationId={conversationId}
        theirListings={theirListings}
        initialAssetId={attached && theirListings.some((c) => c.id === attached.id) ? attached.id : null}
        otherName={otherName}
      />

      <Dialog open={viewer !== null} onOpenChange={(open) => !open && setViewer(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">{t("Photo")}</DialogTitle>
          {viewer && (
            <div className="relative aspect-square w-full">
              <Image src={viewer} alt={t("Photo")} fill sizes="(max-width: 768px) 100vw, 768px" className="object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
