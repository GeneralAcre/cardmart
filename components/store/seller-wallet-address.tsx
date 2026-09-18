"use client";

import { useState } from "react";
import { Check, Copy, Wallet } from "lucide-react";

import { shortSignature } from "@/lib/format";

export function SellerWalletAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-mono text-xs transition-colors"
    >
      <Wallet className="size-3" />
      {shortSignature(address)}
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  );
}
