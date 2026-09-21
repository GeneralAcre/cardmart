import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, MessageSquare, PackageOpen } from "lucide-react";

import { getSellerProfile } from "@/lib/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListingCard } from "@/components/marketplace/listing-card";
import { RatingStars } from "@/components/store/rating-stars";
import { SellerWalletAddress } from "@/components/store/seller-wallet-address";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatDate, formatThb } from "@/lib/format";

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getSellerProfile(id);

  if (!profile) notFound();
  const { seller, listings, rating, reviews, soldHistory } = profile;

  const displayName = seller.name ?? seller.handle ?? "Collector";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="bg-card mb-8 flex items-center gap-4 rounded-xl border p-5">
        <Avatar className="ring-border size-14 shrink-0 ring-2 ring-offset-2">
          {seller.image && <AvatarImage src={seller.image} alt={displayName} />}
          <AvatarFallback className="text-base font-medium">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="truncate text-lg font-semibold">{displayName}</h1>
            {seller.handle && <span className="text-muted-foreground text-sm">@{seller.handle}</span>}
          </div>
          <RatingStars average={rating.average} count={rating.count} size="md" />
          <span className="text-muted-foreground text-xs">
            Member since {formatDate(seller.createdAt)} &middot; {listings.length} listed item
            {listings.length === 1 ? "" : "s"}
          </span>
          {seller.walletAddress && <SellerWalletAddress address={seller.walletAddress} />}
        </div>
      </div>

      {/* Tabs instead of three always-stacked sections — a brand-new
          seller with nothing listed, sold, or reviewed yet would otherwise
          show three consecutive empty-state boxes on first view. */}
      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">Listings ({listings.length})</TabsTrigger>
          <TabsTrigger value="sold">Sold History ({soldHistory.length})</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="pt-6">
          {listings.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
              <PackageOpen className="size-8" />
              <p className="text-sm">Nothing listed for sale right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {listings.map((asset) => (
                <ListingCard key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sold" className="pt-6">
          {soldHistory.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
              <CircleCheck className="size-8" />
              <p className="text-sm">No completed sales yet.</p>
            </div>
          ) : (
            <div className="flex max-w-2xl flex-col gap-2">
              {soldHistory.map((tx) => {
                const photo = tx.asset.verificationPhotos[0];
                return (
                  <Link
                    key={tx.id}
                    href={`/item/${tx.asset.id}`}
                    className="bg-card flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/40"
                  >
                    {photo ? (
                      <Image
                        src={photo.url}
                        alt={tx.asset.name}
                        width={48}
                        height={48}
                        className="size-12 shrink-0 rounded-md border object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-md border">
                        <PackageOpen className="text-muted-foreground size-5" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{tx.asset.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {CATEGORY_LABELS[tx.asset.category]} &middot; Sold{" "}
                        {tx.releasedAt ? formatDate(tx.releasedAt) : formatDate(tx.createdAt)}
                      </span>
                    </div>
                    <span className="text-sm font-semibold">{formatThb(tx.amountThb)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="pt-6">
          {reviews.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
              <MessageSquare className="size-8" />
              <p className="text-sm">No reviews yet — they show up here after a completed sale.</p>
            </div>
          ) : (
            <div className="flex max-w-2xl flex-col gap-3">
              {reviews.map((review) => (
                <div key={review.id} className="bg-card flex flex-col gap-1.5 rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <RatingStars average={review.rating} count={1} showCount={false} />
                    <span className="text-muted-foreground text-xs">{formatDate(review.createdAt)}</span>
                  </div>
                  {review.comment && <p className="text-sm">{review.comment}</p>}
                  <span className="text-muted-foreground text-xs">
                    {review.buyer.name ?? review.buyer.handle ?? "A buyer"} &middot; bought &quot;
                    {review.escrowTx.asset.name}&quot;
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
