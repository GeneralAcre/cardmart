import Link from "next/link";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

export interface Crumb {
  label: React.ReactNode;
  /** Leave out for a crumb that isn't a page of its own (and for the current page, always last). */
  href?: string;
}

/**
 * The one way a page links back up: "Market / Pokémon / Blastoise", with no
 * back arrow. A back control that's a real button (ActionButton) is the only
 * other pattern; plain text links always use this.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-muted-foreground mb-6 flex min-w-0 items-center gap-1.5 text-sm", className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <span aria-hidden>/</span>}
            {last ? (
              <span aria-current="page" className="text-foreground inline-flex min-w-0 items-center gap-1.5 truncate">
                {item.label}
              </span>
            ) : item.href ? (
              <Link href={item.href} className="hover:text-foreground inline-flex shrink-0 items-center gap-1.5 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5">{item.label}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
