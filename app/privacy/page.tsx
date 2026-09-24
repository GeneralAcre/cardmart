import Link from "next/link";

import { SiteFooter } from "@/components/site/footer";

export const metadata = {
  title: "Privacy Policy — CardMart",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span>CardMart</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="text-muted-foreground mt-1 text-sm">Last updated: September 2026</p>

        <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed">
          <section className="rounded-lg border border-dashed p-4">
            <p className="text-muted-foreground">
              CardMart is a Phase 1 academic thesis project. This page
              explains what data the demo platform actually stores and why —
              it&apos;s written for transparency, not as a substitute for legal
              review.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">1. What We Collect</h2>
            <ul className="list-disc pl-5 [&>li]:mt-1">
              <li>Your name, email, and profile image from Google sign-in.</li>
              <li>Your username, shipping address, and phone number, entered during onboarding.</li>
              <li>Live-camera verification photos you capture when listing an item.</li>
              <li>Name, email, and message text if you submit the contact form.</li>
              <li>A mock wallet address if you connect the demo Web3 wallet.</li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">2. How We Use It</h2>
            <p>
              This data operates the marketplace: matching buyers and
              sellers, routing physical items through the warehouse
              inspection flow, and letting our team respond to contact form
              submissions.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">3. Where It&apos;s Stored</h2>
            <p>
              Account, listing, and message data live in a hosted Postgres
              database (Neon). Verification photo files are stored in Vercel
              Blob storage. Authentication is handled by Google via Auth.js.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">4. What We Don&apos;t Do</h2>
            <p>
              We don&apos;t sell your data to third parties. We don&apos;t use your
              contact form submissions or shipping address for anything
              beyond operating this demo.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">5. Your Rights</h2>
            <p>
              You can ask us to delete your account data or contact
              submissions at any time — reach out through the contact form or
              email below.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">6. Contact</h2>
            <p>
              Questions about this policy can be sent to{" "}
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
