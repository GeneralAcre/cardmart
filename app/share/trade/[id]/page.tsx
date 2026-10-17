import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/logo";
import { ThemeToggleButton } from "@/components/site/theme-toggle";
import { ShareActions } from "@/components/share/share-actions";
import { getSaleReceipt } from "@/lib/pnl";
import { getT } from "@/lib/i18n/server";

// The public page behind a shared sale receipt. Anyone can open it (it's
// what a link posted on X or LINE leads to), and its preview image is the
// receipt card itself (app/api/share/trade/[id]).

type Props = { params: Promise<{ id: string }> };

const headline = (r: NonNullable<Awaited<ReturnType<typeof getSaleReceipt>>>) =>
  r.gainPct != null
    ? `${r.gainPct >= 0 ? "+" : ""}${r.gainPct.toFixed(2)}% on ${r.name}`
    : `Sold ${r.name} for THB ${r.soldThb.toLocaleString("en-US")}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const receipt = await getSaleReceipt(id);
  if (!receipt) return { title: "CardMart" };
  const title = `${headline(receipt)} · CardMart`;
  const image = { url: `/api/share/trade/${id}`, width: 1080, height: 1350, alt: headline(receipt) };
  return {
    title,
    description: "Graded cards bought and sold safely on CardMart, with payment held in escrow.",
    openGraph: { title, images: [image] },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

export default async function ShareTradePage({ params }: Props) {
  const { id } = await params;
  const [receipt, t] = await Promise.all([getSaleReceipt(id), getT()]);
  if (!receipt) notFound();
  const imageUrl = `/api/share/trade/${id}`;
  const fileName = `cardmart-${receipt.name.replace(/[^\w-]+/g, "-").toLowerCase()}`;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <ThemeToggleButton />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-4 py-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG; next/image adds nothing here */}
        <img src={imageUrl} alt={headline(receipt)} width={1080} height={1350} className="w-full rounded-2xl border shadow-xl" />
        <ShareActions
          imageUrl={imageUrl}
          pageUrl={`/share/trade/${id}`}
          text={`${headline(receipt)} on @cardmartapp`}
          fileName={fileName}
        />
        <Button asChild variant="ghost">
          <Link href="/">{t("Trade graded cards on CardMart")}</Link>
        </Button>
      </main>
    </div>
  );
}
