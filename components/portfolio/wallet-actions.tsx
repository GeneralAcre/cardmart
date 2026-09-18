"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Check, Copy, ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { requestSolAirdrop } from "@/lib/actions";

const AIRDROP_PRESETS_SOL = [0.5, 1, 2];

// Devnet real SOL transfers are visible on the real (devnet) block explorer —
// this isn't a mock link, the transaction actually lands on-chain.
function explorerTxUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function WalletActions({ solBalance }: { solBalance?: number | null }) {
  const { connected, publicKey, sendSol } = useWalletStore();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  if (!connected || !publicKey) return null;

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setDepositOpen(true)}>
          <ArrowDownToLine /> Deposit
        </Button>
        <Button size="sm" variant="outline" onClick={() => setWithdrawOpen(true)}>
          <ArrowUpFromLine /> Withdraw
        </Button>
      </div>
      <DepositDialog open={depositOpen} onOpenChange={setDepositOpen} walletAddress={publicKey} />
      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        sendSol={sendSol}
        balance={solBalance ?? null}
      />
    </>
  );
}

function TxLink({ signature }: { signature: string }) {
  return (
    <a
      href={explorerTxUrl(signature)}
      target="_blank"
      rel="noreferrer"
      className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 text-xs underline underline-offset-2"
    >
      View on Explorer <ExternalLink className="size-3" />
    </a>
  );
}

function DepositDialog({
  open,
  onOpenChange,
  walletAddress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState(1);
  const [pending, startTransition] = useTransition();
  const [signature, setSignature] = useState<string | null>(null);

  function copyAddress() {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  }

  function handleAirdrop() {
    setSignature(null);
    startTransition(async () => {
      const res = await requestSolAirdrop(amount);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setSignature(res.signature ?? null);
      toast.success(`${amount} SOL deposited`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Deposit</DialogTitle>
        </DialogHeader>

        <button
          type="button"
          onClick={copyAddress}
          className="bg-muted/50 hover:bg-muted flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors"
        >
          <span className="break-all font-mono text-sm">{walletAddress}</span>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Tap to copy"}
          </span>
        </button>

        <div className="flex items-center gap-2">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs">or get free test SOL (no real money)</span>
          <div className="bg-border h-px flex-1" />
        </div>

        <div className="flex gap-2">
          {AIRDROP_PRESETS_SOL.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant={amount === preset ? "default" : "outline"}
              className="flex-1"
              onClick={() => setAmount(preset)}
              disabled={pending}
            >
              {preset} SOL
            </Button>
          ))}
        </div>

        <Button size="lg" className="w-full" onClick={handleAirdrop} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <ArrowDownToLine />}
          {pending ? "Requesting…" : `Deposit ${amount} SOL`}
        </Button>

        {signature && <TxLink signature={signature} />}
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({
  open,
  onOpenChange,
  sendSol,
  balance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sendSol: (toAddress: string, amountSol: number) => Promise<string>;
  balance: number | null;
}) {
  const router = useRouter();
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const amountNumber = Number(amount);
  const canSend = toAddress.trim().length >= 32 && amountNumber > 0 && !sending;

  async function handleSend() {
    setSending(true);
    setSignature(null);
    try {
      const sig = await sendSol(toAddress.trim(), amountNumber);
      setSignature(sig);
      toast.success("Sent");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (sending) return;
        if (!o) {
          setToAddress("");
          setAmount("");
          setSignature(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Withdraw</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Recipient address"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          disabled={sending}
          className="font-mono text-xs"
        />

        <div className="relative">
          <Input
            type="number"
            step="0.0001"
            min={0}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={sending}
            className="pr-28 text-lg font-medium"
          />
          <div className="absolute inset-y-0 right-1.5 flex items-center gap-1.5">
            {balance != null && (
              <button
                type="button"
                onClick={() => setAmount(String(balance))}
                disabled={sending}
                className="text-primary hover:bg-accent rounded px-1.5 py-1 text-xs font-semibold"
              >
                MAX
              </button>
            )}
            <span className="text-muted-foreground pr-1 text-sm font-medium">SOL</span>
          </div>
        </div>
        {balance != null && (
          <span className="text-muted-foreground -mt-2 text-xs">Balance: {balance.toFixed(4)} SOL</span>
        )}

        <Button size="lg" className="w-full" onClick={handleSend} disabled={!canSend}>
          {sending ? <Loader2 className="animate-spin" /> : <ArrowUpFromLine />}
          {sending ? "Sending…" : "Send"}
        </Button>

        {signature && <TxLink signature={signature} />}
      </DialogContent>
    </Dialog>
  );
}
