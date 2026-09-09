import { notFound } from "next/navigation";

import { getAssetById } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { ZoomableCardArt } from "@/components/item/zoomable-card-art";
import { ProvenanceTimeline } from "@/components/item/provenance-timeline";
import { BuyPanel } from "@/components/item/buy-panel";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatGrade } from "@/lib/format";
import {
  CATEGORY_LABELS,
  MARKET_STATUS_BADGE_CLASS,
  MARKET_STATUS_LABELS,
  VERIFICATION_PACKAGE_BADGE_CLASS,
  VERIFICATION_PACKAGE_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [asset, user] = await Promise.all([getAssetById(id), getCurrentUser()]);

  if (!asset) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ZoomableCardArt
            themeIndex={asset.themeIndex}
            category={asset.category}
            gradingCompany={asset.gradingCompany}
            grade={asset.grade}
          />
          <p className="text-muted-foreground text-center text-xs">
            Click artwork to zoom &middot; generated digital twin visualization
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{CATEGORY_LABELS[asset.category]}</Badge>
              <Badge className={cn("border-0", MARKET_STATUS_BADGE_CLASS[asset.marketStatus])}>
                {MARKET_STATUS_LABELS[asset.marketStatus]}
              </Badge>
              {asset.vaulted && <Badge variant="secondary">In Platform Vault</Badge>}
              <Badge className={cn("border-0", VERIFICATION_PACKAGE_BADGE_CLASS[asset.verificationPackage])}>
                {VERIFICATION_PACKAGE_LABELS[asset.verificationPackage]}
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold">{asset.name}</h1>
            <p className="text-muted-foreground text-sm">{asset.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {asset.gradingCompany === "RAW" ? (
              <Badge variant="outline">Raw / Ungraded — verified by camera</Badge>
            ) : (
              <>
                <Badge variant="outline" className="font-mono">
                  Verified Serial: {asset.serial}
                </Badge>
                <Badge variant="outline">
                  {asset.gradingCompany} {formatGrade(asset.grade)}
                </Badge>
              </>
            )}
          </div>

          <div className="text-muted-foreground text-sm">
            Listed by <span className="text-foreground font-medium">{asset.seller.name}</span>
            {asset.owner.id !== asset.seller.id && (
              <>
                {" "}
                &middot; currently owned by{" "}
                <span className="text-foreground font-medium">{asset.owner.name}</span>
              </>
            )}
          </div>

          <Separator />

          <BuyPanel
            assetId={asset.id}
            priceThb={asset.priceThb}
            forSale={asset.forSale}
            vaulted={asset.vaulted}
            marketStatus={asset.marketStatus}
            isOwner={asset.ownerId === user.id}
          />
        </div>
      </div>

      {asset.verificationPhotos.length > 0 && (
        <>
          <Separator className="my-10" />
          <div>
            <h2 className="mb-1 text-lg font-semibold">Live Verification Photos</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Captured live by the seller&apos;s camera at mint time — proof
              the item was physically in hand, not a reused photo.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {asset.verificationPhotos.map((photo) => (
                <div key={photo.id} className="flex flex-col gap-1.5">
                  <div className="aspect-square overflow-hidden rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.viewLabel} className="size-full object-cover" />
                  </div>
                  <span className="text-muted-foreground text-center text-xs">{photo.viewLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator className="my-10" />

      <div className="max-w-2xl">
        <h2 className="mb-6 text-lg font-semibold">Provenance History</h2>
        <ProvenanceTimeline events={asset.provenance} />
      </div>
    </div>
  );
}
