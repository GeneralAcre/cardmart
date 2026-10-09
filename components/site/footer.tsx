import Link from "next/link";

import { ContactDialog } from "@/components/site/contact-dialog";
import { Logo } from "@/components/site/logo";
import { getT } from "@/lib/i18n/server";

const X_URL = "https://x.com/cardmartapp";

const COLUMNS = [
  {
    heading: "Marketplace",
    links: [
      { href: "/marketplace", label: "Market" },
      { href: "/auctions", label: "Auctions" },
      { href: "/agent", label: "Buying agent" },
      { href: "/marketplace/sell", label: "Sell a card" },
      { href: "/portfolio", label: "Portfolio" },
    ],
  },
  {
    heading: "Community",
    links: [
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/news", label: "News" },
      { href: "/guide", label: "Getting Started" },
    ],
  },
  {
    heading: "Support",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/terms", label: "Terms of Use" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
];

// Round icon buttons under the tagline. Add Discord, GitHub, etc. here.
const SOCIAL_LINKS = [
  {
    label: "CardMart on X (@cardmartapp)",
    href: X_URL,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
];

const LINK = "text-muted-foreground hover:text-foreground w-fit text-sm transition-colors";

export async function SiteFooter() {
  const t = await getT();
  return (
    <footer className="border-t pb-14 sm:pb-0">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]">
        <div className="col-span-2 flex flex-col gap-5 md:col-span-1">
          <Link href="/" className="w-fit">
            <Logo />
          </Link>
          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
            {t("Real prices for every card, and a safe place to buy and sell your cards.")}
          </p>
          <div className="flex items-center gap-2">
            {SOCIAL_LINKS.map(({ label, href, icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="text-muted-foreground hover:text-foreground hover:border-foreground/30 flex size-10 items-center justify-center rounded-full border transition-colors"
              >
                {icon}
              </a>
            ))}
          </div>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.heading} className="flex flex-col gap-4">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{t(column.heading)}</h2>
            <ul className="flex flex-col gap-3">
              {column.links.map((link) => (
                <li key={link.href}>
                  {"external" in link ? (
                    <a href={link.href} target="_blank" rel="noreferrer" className={LINK}>
                      {t(link.label)}
                    </a>
                  ) : (
                    <Link href={link.href} className={LINK}>
                      {t(link.label)}
                    </Link>
                  )}
                </li>
              ))}
              {column.heading === "Support" && (
                <li>
                  <ContactDialog className={`${LINK} cursor-pointer text-left`} />
                </li>
              )}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
