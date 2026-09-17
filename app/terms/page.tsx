import Link from "next/link";
import { Gem } from "lucide-react";

import { SiteFooter } from "@/components/site/footer";

export const metadata = {
  title: "Terms of Use — Proof",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Gem className="text-primary size-5" />
            <span>Proof</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold">Terms of Use</h1>
        <p className="text-muted-foreground mt-1 text-sm">Last updated: September 2026</p>

        <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed">
          <section className="rounded-lg border border-dashed p-4">
            <p className="text-muted-foreground">
              Proof is currently a Phase 1 academic thesis project. Escrow,
              payment, and on-chain settlement are simulated (mock) — no real
              money or blockchain transactions occur. These terms describe how
              the demo platform works and are provided for transparency, not
              as legal advice.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">1. Accounts</h2>
            <p>
              You sign in with a Google account. You&apos;re responsible for
              the accuracy of the display name, username, shipping address,
              and phone number you provide during onboarding, since physical
              fulfillment depends on it.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">2. Marketplace &amp; Mock Transactions</h2>
            <p>
              Listings, escrow locks, and wallet signatures on this platform
              are simulated for demonstration purposes. No real currency or
              cryptocurrency changes hands. Prices shown in THB are
              illustrative only.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">3. Physical Items &amp; Verification</h2>
            <p>
              Self-Mint listings rely on seller-submitted live camera captures
              and self-declared certificate details. Full-Service listings
              rely on a simulated grading workflow. Neither replaces a real
              grading company&apos;s official inspection — this is a Phase 1
              demo, not a production authentication service.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">4. Prohibited Conduct</h2>
            <p>
              Don&apos;t use this demo to submit fraudulent certificate data,
              impersonate a real grading company, or upload images you don&apos;t
              have the right to use.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">5. Changes</h2>
            <p>
              These terms may change as the project evolves through its
              thesis phases. Continued use of the platform after a change
              means you accept the updated terms.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">6. Contact</h2>
            <p>
              Questions about these terms can be sent through the contact
              form in the footer, or to{" "}
              <a href="mailto:acreforcoding@gmail.com" className="underline">
                acreforcoding@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
