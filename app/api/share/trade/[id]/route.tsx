/* eslint-disable @next/next/no-img-element -- ImageResponse renders plain <img>; next/image does not apply here. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { getSaleReceipt, type SaleReceipt } from "@/lib/pnl";
import { prisma } from "@/lib/prisma";
import { formatGrade } from "@/lib/format";

// GET /api/share/trade/<sale id>: a shareable receipt card for one completed
// sale, like a trading app's profit card — the card, a big profit %, what it
// was bought and sold for, and who sold it. Public (sale prices already show
// in each card's history) and keyed by the sale's unguessable id; it only
// renders completed sales.

const WIDTH = 1080;
const HEIGHT = 1350;
const LIME = "#CCEF20";
const RED = "#FF4D4D";

// The CardMart star, traced from public/cardmart-logo.png (5 tips, 5 inner
// corners), so the background can draw it large and sharp at any size.
const STAR_POINTS = "120,0 154,50 278,13 182,112 204,196 112,160 1,217 60,130 24,100 85,76";
const Star = ({ size, fill, stroke, strokeWidth = 0 }: { size: number; fill: string; stroke?: string; strokeWidth?: number }) => (
  <svg width={size} height={(size * 218) / 280} viewBox="-2 -2 284 222">
    <polygon points={STAR_POINTS} fill={fill} stroke={stroke ?? "none"} strokeWidth={strokeWidth} strokeLinejoin="round" />
  </svg>
);

const thb = (v: number) => `THB ${Math.round(v).toLocaleString("en-US")}`;

// Local design preview: /api/share/trade/preview renders the newest real
// completed sale as if it had been bought for 22% less, so the profit layout
// can be seen without a sale that has a known cost. Development only; in
// production "preview" is just an unknown sale and returns 404.
const PREVIEW_ID = "preview";

async function previewReceipt(): Promise<SaleReceipt | null> {
  if (process.env.NODE_ENV === "production") return null;
  const latest = await prisma.escrowTransaction.findFirst({
    where: { status: "RELEASED" },
    orderBy: { releasedAt: "desc" },
    select: { id: true },
  });
  const real = latest ? await getSaleReceipt(latest.id) : null;
  if (!real) return null;
  const costThb = Math.round(real.soldThb * 0.78);
  const gainThb = real.soldThb - costThb;
  return { ...real, costThb, costSource: "purchase", gainThb, gainPct: (gainThb / costThb) * 100 };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = id === PREVIEW_ID ? await previewReceipt() : await getSaleReceipt(id);
  if (!receipt) return new Response("Not found", { status: 404 });

  const [bold, black, logo] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-Bold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-Black.ttf")),
    readFile(join(process.cwd(), "public/cardmart-logo.png"), "base64"),
  ]);

  const grade =
    receipt.gradingCompany === "RAW" || receipt.grade == null
      ? "Ungraded"
      : `${receipt.gradingCompany} ${formatGrade(receipt.grade)}${receipt.isBlackLabel ? " Black Label" : ""}`;
  const hasProfit = receipt.gainPct != null && receipt.gainThb != null;
  const up = (receipt.gainThb ?? 0) >= 0;
  const accent = up ? LIME : RED;
  const row = (label: string, value: string, color = "#ffffff") => (
    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 34 }}>
      <span style={{ color: "#8a8a8a" }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          backgroundImage: `radial-gradient(circle at 78% 30%, ${up ? "rgba(204,239,32,0.20)" : "rgba(255,77,77,0.18)"} 0%, rgba(10,10,10,0) 58%)`,
          color: "#ffffff",
          fontFamily: "Geist",
          padding: "72px 72px 56px",
          overflow: "hidden",
        }}
      >
        {/* Background: the CardMart star, huge and faint behind the card,
            running off the right edge, with a small outlined one in the empty
            space beside the prices. */}
        <div style={{ position: "absolute", top: 40, left: 360, display: "flex", transform: "rotate(-14deg)" }}>
          <Star size={1000} fill={up ? "rgba(204,239,32,0.10)" : "rgba(255,77,77,0.10)"} />
        </div>
        <div style={{ position: "absolute", top: 900, left: 790, display: "flex", transform: "rotate(18deg)" }}>
          <Star size={240} fill="none" stroke={up ? "rgba(204,239,32,0.18)" : "rgba(255,77,77,0.18)"} strokeWidth={3} />
        </div>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img alt="" src={`data:image/png;base64,${logo}`} width={64} height={48} style={{ objectFit: "contain" }} />
          <span style={{ fontSize: 48, fontWeight: 900, fontStyle: "italic", letterSpacing: -1 }}>CARDMART</span>
        </div>

        {/* Card picture, tilted, and the headline */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 64 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
            <span style={{ fontSize: 60, fontWeight: 900, lineHeight: 1.05, marginTop: 24 }}>{receipt.name}</span>
            <span style={{ fontSize: 30, color: "#8a8a8a", marginTop: 16 }}>{grade}</span>
            <span style={{ fontSize: 26, color: "#6b6b6b", marginTop: 6 }}>{receipt.subtitle}</span>
          </div>
          {receipt.photoUrl ? (
            <div
              style={{
                display: "flex",
                transform: "rotate(8deg)",
                marginTop: -10,
                marginRight: 10,
                borderRadius: 20,
                boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
              }}
            >
              <img alt="" src={receipt.photoUrl} width={330} height={460} style={{ objectFit: "contain", borderRadius: 18 }} />
            </div>
          ) : (
            <div style={{ display: "flex", width: 330, height: 460 }} />
          )}
        </div>

        {/* The number */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          <span style={{ fontSize: 30, color: "#8a8a8a" }}>{hasProfit ? "Profit" : "Sold for"}</span>
          <span style={{ fontSize: 168, fontWeight: 900, color: hasProfit ? accent : "#ffffff", lineHeight: 1, letterSpacing: -4 }}>
            {hasProfit ? `${up ? "+" : ""}${receipt.gainPct!.toFixed(2)}%` : thb(receipt.soldThb)}
          </span>
        </div>

        {/* The prices behind it */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 36, width: 620 }}>
          {receipt.costThb != null && row("Bought for", thb(receipt.costThb))}
          {/* Without a known cost the headline is already the sale price. */}
          {hasProfit && row("Sold for", thb(receipt.soldThb))}

        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "auto",
            paddingTop: 36,
            borderTop: "3px dashed #333333",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 36, fontWeight: 900 }}>Trade graded cards on CardMart</span>
            <span style={{ fontSize: 26, color: "#8a8a8a", marginTop: 6 }}>Payment held in escrow until the card checks out</span>
          </div>
          <span style={{ fontSize: 28, color: "#8a8a8a" }}>
            {receipt.sellerHandle ? `@${receipt.sellerHandle}` : receipt.sellerName}
          </span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "Geist", data: bold, weight: 700, style: "normal" },
        { name: "Geist", data: black, weight: 900, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=300" },
    },
  );
}
