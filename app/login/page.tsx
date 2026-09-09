import { Gem, ShieldCheck } from "lucide-react";

import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border p-8 text-center shadow-sm">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <Gem className="text-primary size-5" />
          <span>Provenance</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Join the marketplace</h1>
          <p className="text-muted-foreground text-sm">
            Sign in with Google to browse, verify, and trade certified
            collectibles secured by physical escrow.
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="w-full"
        >
          <Button type="submit" size="lg" className="w-full">
            <svg viewBox="0 0 24 24" className="size-4">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29A11.96 11.96 0 000 12c0 1.93.46 3.76 1.29 5.38l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            Continue with Google
          </Button>
        </form>

        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5" />
          Phase 1 mock marketplace — your Google account is only used to sign in.
        </div>
      </div>
    </div>
  );
}
