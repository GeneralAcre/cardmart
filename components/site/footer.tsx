import Image from "next/image";
import Link from "next/link";

import { ContactForm } from "@/components/site/contact-form";
import { getT } from "@/lib/i18n/server";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/guide", label: "Getting Started" },
  { href: "/listing", label: "Listing" },
  { href: "/portfolio", label: "Portfolio" },
];

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Policy" },
];

const SOCIAL_LINKS = [
  { label: "X", href: "#", image: "/X-logo.png" },
  // Hidden for now — uncomment to show the GitHub link again.
  // { label: "GitHub", href: "https://github.com/GeneralAcre/id-thesis", image: "/Github-logo.png" },
];

const COLUMN_HEADING = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export async function SiteFooter() {
  const t = await getT();
  return (
    <footer className="border-t pb-14 sm:pb-0">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 sm:grid-cols-2 md:grid-cols-4">
        <div className="flex flex-col gap-4">
          <h2 className={COLUMN_HEADING}>{t("Contact & Support")}</h2>
          <ContactForm />
        </div>

        <div className="flex flex-col gap-4">
          <h2 className={COLUMN_HEADING}>{t("Navigation")}</h2>
          <nav className="flex flex-col gap-2.5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground w-fit text-sm transition-colors"
              >
                {t(link.label)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className={COLUMN_HEADING}>{t("Legal & Compliance")}</h2>
          <nav className="flex flex-col gap-2.5">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground w-fit text-sm transition-colors"
              >
                {t(link.label)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className={COLUMN_HEADING}>{t("Social")}</h2>
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map(({ label, href, image }) => (
              <Link
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="hover:border-foreground/30 relative flex size-9 items-center justify-center overflow-hidden rounded-md border transition-colors"
              >
                <Image src={image} alt={label} fill sizes="36px" className="object-cover" />
                <span className="sr-only">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </footer>
  );
}
