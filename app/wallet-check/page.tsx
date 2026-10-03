"use client";

// TEMPORARY diagnostic page — remove once the Phantom login issue is solved.
// Talks to browser wallets directly (Wallet Standard + Phantom's legacy
// window.phantom.solana), bypassing Privy, so the wallet's real error is
// visible instead of Privy's generic_connect_wallet_error. Nothing is sent
// to any server; the signed test message is only displayed.

import { useEffect, useState } from "react";
import { useConnectWallet, useLoginWithSiws, VERSION } from "@privy-io/react-auth";
import { useWallets as usePrivySolanaWallets } from "@privy-io/react-auth/solana";

type StdAccount = { address: string; chains: readonly string[] };
type StdWallet = {
  name: string;
  version: string;
  chains: readonly string[];
  accounts: readonly StdAccount[];
  features: Record<string, any>;
};

function describeError(e: unknown) {
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return JSON.stringify(
      { name: o.name, message: o.message, code: o.code, cause: String(o.cause ?? "") },
      null,
      2,
    );
  }
  return String(e);
}

export default function WalletCheckPage() {
  const [wallets, setWallets] = useState<StdWallet[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const add = (line: string) => setLog((l) => [...l, line]);
  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => add(`Privy connect OK: ${wallet.address}`),
    onError: (err) => add(`Privy connect ERROR: ${err}`),
  });
  const { wallets: privyWallets } = usePrivySolanaWallets();
  const { generateSiwsMessage, generateSiwsOffchainMessage } = useLoginWithSiws();

  // Signs the real login message in both formats WITHOUT logging in, to see
  // which one Phantom (in testnet mode) will show.
  async function testLoginFormats() {
    const w = privyWallets[0];
    add("--- Login message formats ---");
    if (!w) return add("(click '1. Privy connect' first)");
    let message: string;
    try {
      message = await generateSiwsMessage({ address: w.address });
    } catch (e) {
      return add(`generateSiwsMessage ERROR:\n${describeError(e)}`);
    }
    for (const [label, bytes] of [
      ["off-chain", () => generateSiwsOffchainMessage({ message, address: w.address })],
      ["plain", () => new TextEncoder().encode(message)],
    ] as const) {
      try {
        const out = await w.signMessage({ message: bytes() });
        add(`${label}: OK, signature bytes: ${out.signature.length}`);
      } catch (e) {
        add(`${label}: ERROR\n${describeError(e)}`);
      }
    }
  }

  // Same sign call Privy's login makes, but with the real error shown.
  async function testPrivySign() {
    add(`--- Privy ${VERSION} signMessage ---`);
    add(`Privy Solana wallets: ${privyWallets.map((w) => `${w.standardWallet.name} ${w.address}`).join(", ") || "(none — click 'Privy connect' first)"}`);
    const w = privyWallets[0];
    if (!w) return;
    try {
      const out = await w.signMessage({ message: new TextEncoder().encode("CardMart wallet check") });
      add(`Privy signMessage OK, signature bytes: ${out.signature.length}`);
    } catch (e) {
      add(`Privy signMessage ERROR:\n${describeError(e)}`);
    }
  }

  useEffect(() => {
    const found: StdWallet[] = [];
    const register = (...ws: StdWallet[]) => {
      for (const w of ws) if (!found.includes(w)) found.push(w);
      setWallets([...found]);
      return () => {};
    };
    const api = { register };
    const onRegister = (e: Event) => (e as CustomEvent).detail(api);
    window.addEventListener("wallet-standard:register-wallet", onRegister);
    window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api }));
    return () => window.removeEventListener("wallet-standard:register-wallet", onRegister);
  }, []);

  async function testStandard(w: StdWallet) {
    add(`--- ${w.name} (Wallet Standard) ---`);
    add(`chains: ${w.chains.join(", ")}`);
    add(`features: ${Object.keys(w.features).join(", ")}`);
    try {
      const res = await w.features["standard:connect"].connect();
      const accounts: StdAccount[] = res?.accounts ?? w.accounts;
      add(`connect OK, accounts: ${accounts.map((a) => a.address).join(", ") || "(none)"}`);
      const account = accounts[0];
      if (!account) return add("No account returned — wallet has no Solana account for this site.");
      const signer = w.features["solana:signMessage"];
      if (!signer) return add("Wallet has no solana:signMessage feature.");
      const message = new TextEncoder().encode(`CardMart wallet check ${new Date().toISOString()}`);
      const [out] = await signer.signMessage({ account, message });
      add(`signMessage OK, signature bytes: ${out?.signature?.length}`);
    } catch (e) {
      add(`ERROR:\n${describeError(e)}`);
    }
  }

  async function testPhantomLegacy() {
    add("--- window.phantom.solana (legacy) ---");
    const p = (window as any).phantom?.solana;
    if (!p) return add("window.phantom.solana not found.");
    add(`isPhantom: ${p.isPhantom}`);
    try {
      const { publicKey } = await p.connect();
      add(`connect OK: ${publicKey?.toString()}`);
      const out = await p.signMessage(new TextEncoder().encode("CardMart wallet check"), "utf8");
      add(`signMessage OK, signature bytes: ${out?.signature?.length}`);
    } catch (e) {
      add(`ERROR:\n${describeError(e)}`);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6 font-mono text-sm">
      <h1 className="text-lg font-bold">Wallet check (temporary)</h1>
      <p>Click a wallet. Approve both Phantom popups if they appear. Then screenshot the log.</p>
      <div className="flex flex-wrap gap-2">
        {wallets
          .filter((w) => w.chains.some((c) => c.startsWith("solana:")))
          .map((w) => (
            <button key={w.name} onClick={() => testStandard(w)} className="rounded border px-3 py-2">
              {w.name}
            </button>
          ))}
        <button onClick={testPhantomLegacy} className="rounded border px-3 py-2">
          Phantom (legacy)
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => connectWallet({ walletChainType: "solana-only" })} className="rounded border px-3 py-2">
          1. Privy connect
        </button>
        <button onClick={testPrivySign} className="rounded border px-3 py-2">
          2. Privy sign
        </button>
        <button onClick={testLoginFormats} className="rounded border px-3 py-2">
          3. Login formats
        </button>
      </div>
      <p>All wallets detected: {wallets.map((w) => w.name).join(", ") || "(none yet)"}</p>
      <pre className="whitespace-pre-wrap rounded border p-3">{log.join("\n") || "(log empty)"}</pre>
    </main>
  );
}
