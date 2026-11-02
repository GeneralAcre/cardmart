"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { EditProfileButton, ProfileAvatar, ProfileBio, ProfileCover } from "@/components/profile/profile-cover";
import { WalletActions } from "@/components/portfolio/wallet-actions";
import { IdentityBadge } from "@/components/portfolio/identity-card";
import { LevelBadge } from "@/components/profile/level-badge";
import type { Level } from "@/lib/rewards";
import type { AchievementIcon, AchievementTier } from "@/lib/achievements";
import { AchievementsButton } from "@/components/profile/achievements-button";
import { ItemShareButton } from "@/components/item/share-button";
import type { KycStatus } from "@prisma/client";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { formatDate, shortSignature } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";

interface ProfileHeaderProps {
  /** The user's id, for the link to their public store page that the share icon copies. */
  userId: string;
  name: string;
  handle: string | null;
  image: string | null;
  coverImage: string | null;
  bio: string | null;
  walletAddress: string | null;
  createdAt: Date;
  /** Real devnet SOL balance, or null if there's no wallet / the RPC call failed. */
  solBalance: number | null;
  identity: {
    status: KycStatus;
    rejectReason: string | null;
    rating: number | null;
    reviewCount: number;
    completedSales: number;
    photoStorageReady: boolean;
  };
  /** Rewards level and XP, shown as a badge beside the name. */
  level: { level: Level; xp: number };
  /** Earned badges (for the Achievements button) and how many there are in all. */
  badges: { earned: { id: string; icon: AchievementIcon; tier: AchievementTier }[]; total: number };
}

export function ProfileHeader({
  userId,
  name,
  handle,
  image,
  coverImage,
  bio,
  walletAddress,
  createdAt,
  solBalance,
  identity,
  level,
  badges,
}: ProfileHeaderProps) {
  const { connected } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const t = useT();
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function copyWallet() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    toast.success(t("Wallet address copied"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Like a social profile: your cover across the top with your picture
  // overlapping its lower edge, your actions to the right, then who you are.
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <ProfileCover cover={coverImage} editable />
        {/* Phones: picture, then you, then the buttons full width. From sm up the buttons sit beside the picture. */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 px-4 sm:px-6">
          <div className="-mt-12 shrink-0 sm:-mt-16">
            <ProfileAvatar image={image} name={name} initials={initials} editable />
          </div>
          <div className="order-3 mt-4 flex w-full flex-wrap gap-2 sm:order-none sm:mt-3 sm:w-auto sm:justify-end [&_button]:flex-1 sm:[&_button]:flex-none">
            {connected && <WalletActions solBalance={solBalance} />}
            <EditProfileButton bio={bio} />
            <AchievementsButton {...badges} />
          </div>
          <div className="mt-3 flex w-full min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-xl font-semibold sm:text-2xl">{name}</span>
              <IdentityBadge {...identity} />
              <LevelBadge level={level.level} xp={level.xp} />
              <ItemShareButton path={`/store/${userId}`} />
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-sm">
              {handle && <span>@{handle}</span>}
            </div>
            <ProfileBio bio={bio} className="mt-1.5" />
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {walletAddress ? (
                <button
                  type="button"
                  onClick={copyWallet}
                  className="hover:text-foreground flex items-center gap-1.5 font-mono transition-colors"
                >
                  {shortSignature(walletAddress)}
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                </button>
              ) : (
                <span>{t("No wallet connected")}</span>
              )}
              <span className="text-border">&middot;</span>
              <span>{t("Member since {date}", { date: formatDate(createdAt) })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
