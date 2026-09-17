import { notFound } from "next/navigation";
import { PackageOpen } from "lucide-react";

import { getSellerProfile } from "@/lib/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListingCard } from "@/components/marketplace/listing-card";
import { formatDate } from "@/lib/format";

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getSellerProfile(id);

  if (!profile) notFound();
  const { seller, listings } = profile;

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
          <span className="text-muted-foreground text-xs">
            Member since {formatDate(seller.createdAt)} &middot; {listings.length} listed item
            {listings.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold">Listings</h2>
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
    </div>
  );
}
