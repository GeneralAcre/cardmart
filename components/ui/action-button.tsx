import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACTION_BUTTON_CLASS = cn(buttonVariants({ variant: "default" }), "h-10 px-5");

type ActionButtonProps = {
  /** Optional lucide icon shown before the label. */
  icon?: LucideIcon;
  children: ReactNode;
} & (
  | ({ href: string } & Omit<ComponentProps<typeof Link>, "href" | "children">)
  | ({ href?: undefined } & Omit<ComponentProps<"button">, "children">)
);

/**
 * The page-level action button — "Sell a card", "Back", "Create Auction":
 * white, one height and text size everywhere, so only the label (and icon)
 * changes between pages. Pass `href` for a link; otherwise it's a button
 * (works as a Radix `asChild` trigger too).
 */
export function ActionButton({ icon: Icon, children, className, ...props }: ActionButtonProps) {
  const content = (
    <>
      {Icon && <Icon />}
      {children}
    </>
  );
  if (props.href !== undefined) {
    return (
      <Link {...props} className={cn(ACTION_BUTTON_CLASS, className)}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" {...props} className={cn(ACTION_BUTTON_CLASS, className)}>
      {content}
    </button>
  );
}
