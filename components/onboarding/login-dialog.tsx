"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Wallet } from "lucide-react";
import { getWallets } from "@wallet-standard/app";
import type { Wallet as StandardWallet } from "@wallet-standard/base";
import {
  useConnectWallet,
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithSiws,
  type WalletListEntry,
} from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { shortSignature } from "@/lib/format";
import { useLanguage } from "@/components/landing/language-provider";

// Our own sign-in window, drawn with Privy's headless hooks instead of
// Privy's modal: email with a one-time code, social sign-in, and Solana
// wallets. Privy still does all of the actual authentication.
//
// Social providers shown. Each one must also be switched on in the Privy
// Dashboard (Settings -> Login Methods): only Google is today, so add
// "twitter" or "discord" here once they're enabled there.
const SOCIAL_PROVIDERS = ["google"] as const;
type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

// Installed wallets Privy can open straight away, by the name they register
// under; any other installed Solana wallet goes through "More wallets".
const PRIVY_WALLET_IDS: Record<string, WalletListEntry> = {
  phantom: "phantom",
  solflare: "solflare",
  backpack: "backpack",
  jupiter: "jupiter",
  "okx wallet": "okx_wallet",
  "bitget wallet": "bitget_wallet",
};

// Solana wallets installed in this browser (Wallet Standard), for the row of
// wallet buttons with each wallet's own icon.
const walletsApi = typeof window === "undefined" ? null : getWallets();
let detectedCache: readonly StandardWallet[] = [];
function detectedSolanaWallets() {
  const all = walletsApi?.get() ?? [];
  const solana = all.filter(
    (w) => w.chains.some((c) => c.startsWith("solana:")) && PRIVY_WALLET_IDS[w.name.toLowerCase()],
  );
  // Same array back while nothing changed, as useSyncExternalStore requires.
  if (solana.length !== detectedCache.length || solana.some((w, i) => w !== detectedCache[i])) detectedCache = solana;
  return detectedCache;
}
function subscribeWallets(onChange: () => void) {
  if (!walletsApi) return () => {};
  const offRegister = walletsApi.on("register", onChange);
  const offUnregister = walletsApi.on("unregister", onChange);
  return () => {
    offRegister();
    offUnregister();
  };
}
const NO_WALLETS: readonly StandardWallet[] = [];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

const SOCIAL: Record<SocialProvider, { label: string; icon: React.ReactNode }> = {
  google: { label: "Google", icon: <GoogleIcon /> },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginDialog({
  open,
  onOpenChange,
  redirectTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo: string;
}) {
  const { tr } = useLanguage();
  const [email, setEmail] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "send" | "verify" | SocialProvider | "sign">(null);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  // Set once sign-in has worked, while the page loads the app.
  const [done, setDone] = useState(false);

  // Hard navigation on purpose, not router.push(): Privy's client state flips
  // to signed in slightly before the privy-id-token cookie is readable by the
  // server, and a full page load gives the cookie time to land before
  // proxy.ts / getCurrentUser() check it.
  //
  // onComplete also fires on mount when Privy already considers the user
  // signed in (wasAlreadyAuthenticated). That's ignored: the landing page
  // must never move anyone into the app on its own. A Google sign-in comes
  // back to this page from Google's redirect and finishes here, which is why
  // these hooks live in this always-mounted component.
  const callbacks = {
    onComplete: ({ wasAlreadyAuthenticated }: { wasAlreadyAuthenticated: boolean }) => {
      if (wasAlreadyAuthenticated) return;
      setDone(true);
      window.location.href = redirectTo;
    },
    onError: (e: string) => {
      setBusy(null);
      if (e !== "exited_auth_flow") toast.error(tr("Sign-in failed"), { description: e });
    },
  };
  const { sendCode, loginWithCode } = useLoginWithEmail(callbacks);
  const { initOAuth } = useLoginWithOAuth(callbacks);
  const { generateSiwsMessage, generateSiwsOffchainMessage, loginWithSiws } = useLoginWithSiws();
  const { wallets } = useWallets();
  const detected = useSyncExternalStore(subscribeWallets, detectedSolanaWallets, () => NO_WALLETS);

  // Privy fires connectWallet callbacks on every mounted hook, and the
  // landing page renders the Login button twice (nav + hero): only the
  // window that actually asked should react.
  const pending = useRef(false);
  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      if (!pending.current) return;
      pending.current = false;
      setWalletAddress(wallet.address);
    },
    onError: (e) => {
      if (!pending.current) return;
      pending.current = false;
      if (e !== "exited_auth_flow") toast.error(tr("Sign-in failed"), { description: e });
    },
  });
  const wallet = wallets.find((w) => w.address === walletAddress);

  function message(e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setError(tr("Enter a valid email address."));
      return;
    }
    setError(null);
    setBusy("send");
    try {
      await sendCode({ email: value });
      setCodeSentTo(value);
      setCode("");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  }

  async function verify(value: string) {
    if (value.length !== 6) return;
    setError(null);
    setBusy("verify");
    try {
      await loginWithCode({ code: value });
    } catch (err) {
      setBusy(null);
      setError(tr("That code didn't work. Check it and try again, or send a new one."));
      console.warn("[login] code", message(err));
    }
  }

  async function handleSocial(provider: SocialProvider) {
    setBusy(provider);
    try {
      await initOAuth({ provider }); // leaves the page for the provider's sign-in
    } catch (err) {
      setBusy(null);
      toast.error(tr("Sign-in failed"), { description: message(err) });
    }
  }

  function handleConnect(id?: WalletListEntry) {
    pending.current = true;
    connectWallet({ walletChainType: "solana-only", ...(id ? { walletList: [id] } : {}) });
  }

  async function handleDisconnect() {
    await wallet?.disconnect().catch(() => {});
    setWalletAddress(null);
  }

  // Connect, then sign from its own click: Phantom rejects a sign request
  // that fires the instant it connects (which is what Privy's own modal does).
  async function handleSign() {
    if (!wallet) return;
    setBusy("sign");
    try {
      const siws = await generateSiwsMessage({ address: wallet.address });
      // Plain text first, which Phantom signs (it refuses the off-chain
      // format). The Solana off-chain message format is the fallback for
      // hardware wallets (Ledger) that reject plain text; a user simply
      // declining (4001) isn't retried.
      let signed: Uint8Array;
      let messageType: "offchain-message" | "plain" = "plain";
      try {
        signed = (await wallet.signMessage({ message: new TextEncoder().encode(siws) })).signature;
      } catch (e) {
        if ((e as { code?: number })?.code === 4001 && !/chain/i.test(message(e))) throw e;
        messageType = "offchain-message";
        try {
          const offchain = generateSiwsOffchainMessage({ message: siws, address: wallet.address });
          signed = (await wallet.signMessage({ message: offchain })).signature;
        } catch (offchainError) {
          throw new Error(`${message(e)} (off-chain format: ${message(offchainError)})`);
        }
      }
      await loginWithSiws({
        message: siws,
        signature: btoa(String.fromCharCode(...signed)),
        walletClientType: wallet.standardWallet.name.toLowerCase(),
        connectorType: "solana_adapter",
        messageType,
      });
      setDone(true);
      window.location.href = redirectTo;
    } catch (e) {
      setBusy(null);
      toast.error(tr("Sign-in failed"), { description: message(e) });
    }
  }

  const pillButton =
    "border-border hover:bg-accent flex h-11 items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy === "verify" || busy === "sign" || done) return; // don't close mid sign-in
        onOpenChange(next);
      }}
    >
      <DialogContent className="bg-card gap-0 rounded-2xl p-0 sm:max-w-md sm:p-0">
        <div className="flex flex-col gap-1 px-6 pt-6 pb-5">
          <DialogTitle className="text-xl">{tr("Log in / Sign up to CardMart")}</DialogTitle>
          <DialogDescription className="sr-only">
            {tr("Sign in with your email, Google or a Solana wallet.")}
          </DialogDescription>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 px-6 pt-4 pb-12 text-center">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
            <p className="text-sm font-medium">{tr("Signing you in…")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-6 pb-6">
            {/* Email: address and Send code in one field, then the code in its place. */}
            {codeSentTo ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-sm font-medium">{tr("Code from your email")}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCodeSentTo(null);
                      setError(null);
                    }}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                  >
                    <ArrowLeft className="size-3" />
                    {tr("Change email")}
                  </button>
                </div>
                <div className="bg-background focus-within:ring-ring/50 flex items-center gap-2 rounded-2xl border p-1.5 pl-4 focus-within:ring-2">
                  <input
                    autoFocus
                    value={code}
                    onChange={(e) => {
                      const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setCode(next);
                      if (next.length === 6) void verify(next);
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    aria-label={tr("6-digit code")}
                    className="min-w-0 flex-1 bg-transparent font-mono text-lg tracking-[0.4em] outline-none"
                    disabled={busy === "verify"}
                  />
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() => verify(code)}
                    disabled={code.length !== 6 || busy === "verify"}
                  >
                    {busy === "verify" && <Loader2 className="animate-spin" />}
                    {tr("Verify")}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  {tr("We sent a 6-digit code to {email}.", { email: codeSentTo })}{" "}
                  <button
                    type="button"
                    onClick={() => sendCode({ email: codeSentTo }).then(() => toast.success(tr("New code sent")))}
                    className="text-foreground underline underline-offset-2"
                  >
                    {tr("Send again")}
                  </button>
                </p>
                {error && <p className="text-destructive text-xs">{error}</p>}
              </div>
            ) : (
              <form onSubmit={handleSendCode} className="flex flex-col gap-2">
                <label htmlFor="login-email" className="text-muted-foreground text-sm font-medium">
                  {tr("Email")}
                </label>
                <div className="bg-background focus-within:ring-ring/50 flex items-center gap-2 rounded-2xl border p-1.5 pl-4 focus-within:ring-2">
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                  <Button type="submit" className="rounded-full" disabled={busy === "send" || !email.trim()}>
                    {busy === "send" && <Loader2 className="animate-spin" />}
                    {tr("Send code")}
                  </Button>
                </div>
                {error && <p className="text-destructive text-xs">{error}</p>}
              </form>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-sm font-medium">{tr("Social login")}</span>
              <div className={cn("grid gap-2", SOCIAL_PROVIDERS.length > 1 && "grid-cols-3")}>
                {SOCIAL_PROVIDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSocial(p)}
                    disabled={busy !== null}
                    aria-label={tr("Continue with {provider}", { provider: SOCIAL[p].label })}
                    className={pillButton}
                  >
                    {busy === p ? <Loader2 className="size-5 animate-spin" /> : SOCIAL[p].icon}
                    {SOCIAL_PROVIDERS.length === 1 && tr("Continue with {provider}", { provider: SOCIAL[p].label })}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-muted-foreground flex items-center gap-3 text-xs font-medium">
              <span className="bg-border h-px flex-1" />
              {tr("Or continue with wallet")}
              <span className="bg-border h-px flex-1" />
            </div>

            <div className="flex flex-col gap-2">
              {walletAddress && (
                <>
                  <div className="border-success/40 bg-success/10 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="text-success text-[11px] font-semibold tracking-wider uppercase">
                        {tr("Connected")}
                      </span>
                      <span className="truncate font-mono text-sm">{shortSignature(walletAddress)}</span>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleDisconnect} disabled={busy === "sign"}>
                      {tr("Disconnect")}
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {tr("Your wallet signs a message to prove it's yours. No transaction is sent.")}
                  </p>
                  <Button type="button" variant="secondary" className="h-11 rounded-xl" onClick={handleSign} disabled={!wallet || busy !== null}>
                    {busy === "sign" ? <Loader2 className="animate-spin" /> : <Wallet />}
                    {tr("Sign in with wallet")}
                  </Button>
                </>
              )}
              {/* Installed wallets with their own icons, then everything else. */}
              <div className="grid grid-cols-4 gap-2">
                {detected.slice(0, 3).map((w) => (
                  <button
                    key={w.name}
                    type="button"
                    onClick={() => handleConnect(PRIVY_WALLET_IDS[w.name.toLowerCase()])}
                    disabled={busy !== null}
                    title={w.name}
                    aria-label={tr("Connect {wallet}", { wallet: w.name })}
                    className={pillButton}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI from the wallet itself */}
                    <img src={w.icon} alt="" className="size-6 rounded-md" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleConnect()}
                  disabled={busy !== null}
                  className={cn(pillButton, "text-muted-foreground px-3", detected.length === 0 && "col-span-4")}
                >
                  {detected.length === 0 && <Wallet className="size-4" />}
                  {detected.length === 0 ? tr("Connect a Solana wallet") : tr("More wallets")}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-muted-foreground border-t px-6 py-4 text-center text-xs">
          {tr("By continuing, you agree to our")}{" "}
          <Link href="/terms" className="text-foreground underline underline-offset-2">
            {tr("Terms of Service")}
          </Link>{" "}
          {tr("and")}{" "}
          <Link href="/privacy" className="text-foreground underline underline-offset-2">
            {tr("Privacy Policy")}
          </Link>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
