"use client";

import { useId } from "react";
import {
  BadgeCheck,
  Bot,
  Boxes,
  Coins,
  Crown,
  Gavel,
  Gem,
  Lock,
  Medal,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AchievementIcon, AchievementTier } from "@/lib/achievements";
import { cn } from "@/lib/utils";

const ICONS: Record<AchievementIcon, LucideIcon> = {
  verified: BadgeCheck,
  tag: Tag,
  store: Store,
  coins: Coins,
  gem: Gem,
  bag: ShoppingBag,
  boxes: Boxes,
  gavel: Gavel,
  star: Star,
  bot: Bot,
  users: Users,
  crown: Crown,
  trophy: Trophy,
  medal: Medal,
};

// Each tier's metal: light edge, main colour, shadow, and the glow behind the icon.
const METAL: Record<AchievementTier, { light: string; mid: string; dark: string; glow: string; icon: string }> = {
  bronze: { light: "#ffd9b3", mid: "#c8702f", dark: "#4a210a", glow: "#f08a3c", icon: "#ffe2c4" },
  silver: { light: "#ffffff", mid: "#a8adb8", dark: "#33363d", glow: "#cfe3ff", icon: "#f4f7ff" },
  gold: { light: "#fff6c4", mid: "#f2b500", dark: "#5e3a00", glow: "#ffd23d", icon: "#fff3c0" },
};

const OUTER = "50,2 93,26 93,74 50,98 7,74 7,26";
const FACE = "50,9 87,30 87,70 50,91 13,70 13,30";
const INNER = "50,17 80,34 80,66 50,83 20,66 20,34";

const SIZE = {
  sm: { box: "size-6", icon: "size-3", lock: "size-2.5" },
  md: { box: "size-24", icon: "size-9", lock: "size-7" },
  lg: { box: "size-40", icon: "size-16", lock: "size-11" },
} as const;

/**
 * A badge drawn as a hexagonal medal: a metal rim in its tier's colour, a
 * dark face lit from the middle with light rays, an inner ring, and the
 * badge's icon. A badge not earned yet is drained of colour with a lock on top.
 */
export function BadgeEmblem({
  icon,
  tier,
  earned,
  size = "md",
  className,
}: {
  icon: AchievementIcon;
  tier: AchievementTier;
  earned: boolean;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const id = useId();
  const m = METAL[tier];
  const Icon = ICONS[icon];
  const s = SIZE[size];

  return (
    <div className={cn("relative shrink-0", s.box, className)}>
      <svg
        viewBox="0 0 100 100"
        aria-hidden
        className={cn("size-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]", !earned && "opacity-55 grayscale")}
      >
        <defs>
          <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={m.light} />
            <stop offset="0.45" stopColor={m.mid} />
            <stop offset="0.7" stopColor={m.dark} />
            <stop offset="1" stopColor={m.mid} />
          </linearGradient>
          <radialGradient id={`${id}-face`} cx="0.5" cy="0.45" r="0.6">
            <stop offset="0" stopColor={m.glow} stopOpacity="0.55" />
            <stop offset="0.55" stopColor={m.dark} stopOpacity="0.9" />
            <stop offset="1" stopColor="#0b0b0d" />
          </radialGradient>
          <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <polygon points={FACE} />
          </clipPath>
        </defs>

        {/* Rim, with a darker bevel line inside it. */}
        <polygon points={OUTER} fill={`url(#${id}-rim)`} />
        <polygon points={FACE} fill="none" stroke={m.dark} strokeWidth="2.5" />
        {/* Face, lit from the middle. */}
        <polygon points={FACE} fill={`url(#${id}-face)`} />
        {/* Light rays fanning out from behind the icon. */}
        <g clipPath={`url(#${id}-clip)`} opacity="0.35">
          {Array.from({ length: 12 }, (_, i) => (
            <polygon key={i} points="50,50 47,0 53,0" fill={m.glow} transform={`rotate(${i * 30} 50 50)`} />
          ))}
        </g>
        {/* Inner ring and its notches. */}
        <polygon points={INNER} fill="none" stroke={m.mid} strokeOpacity="0.7" strokeWidth="1.2" />
        {[
          [50, 17],
          [80, 34],
          [80, 66],
          [50, 83],
          [20, 66],
          [20, 34],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill={m.light} />
        ))}
        {/* A soft shine over the top half. */}
        <polygon points={OUTER} fill={`url(#${id}-shine)`} />
      </svg>

      <Icon
        className={cn("absolute inset-0 m-auto drop-shadow-[0_0_6px_rgba(0,0,0,0.6)]", s.icon, !earned && "opacity-40")}
        style={{ color: earned ? m.icon : "#a1a1aa" }}
        strokeWidth={1.75}
      />
      {!earned && (
        <Lock className={cn("absolute inset-0 m-auto text-white drop-shadow-md", s.lock)} fill="currentColor" strokeWidth={1.5} />
      )}
    </div>
  );
}
