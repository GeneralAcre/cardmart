"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Check, Copy, ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { requestSolAirdrop } from "@/lib/actions";

const AIRDROP_PRESETS_SOL = [0.5, 1, 2];

// Devnet real SOL transfers are visible on the real (devnet) block explorer —
// this isn't a mock link, the transaction actually lands on-chain.
function explorerTxUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function WalletActions() {
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
      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} sendSol={sendSol} />
    </>
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
      toast.success(`${amount} devnet SOL deposited`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deposit</DialogTitle>
          <DialogDescription>
            This is a devnet wallet, so there&apos;s no real money to wire in — fund it either way below.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label>Receive from another wallet</Label>
          <button
            type="button"
            onClick={copyAddress}
            className="bg-muted/50 hover:bg-muted flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors"
          >
            <span className="flex-1 truncate font-mono text-xs">{walletAddress}</span>
            {copied ? (
              <Check className="size-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Copy className="text-muted-foreground size-3.5 shrink-0" />
            )}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Or request a devnet faucet airdrop</Label>
          <div className="flex gap-2">
            {AIRDROP_PRESETS_SOL.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={amount === preset ? "default" : "outline"}
                onClick={() => setAmount(preset)}
                disabled={pending}
              >
                {preset} SOL
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Real devnet SOL, minted directly into your wallet — the faucet is rate-limited, so retry
            later if it fails.
          </p>
        </div>

        {signature && (
          <a
            href={explorerTxUrl(signature)}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline underline-offset-2"
          >
            View transaction on Solana Explorer <ExternalLink className="size-3" />
          </a>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Close
          </Button>
          <Button onClick={handleAirdrop} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <ArrowDownToLine />}
            {pending ? "Requesting…" : `Deposit ${amount} SOL`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({
  open,
  onOpenChange,
  sendSol,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sendSol: (toAddress: string, amountSol: number) => Promise<string>;
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
      toast.success("Withdrawal sent");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw</DialogTitle>
          <DialogDescription>
            Sends a real, on-chain devnet SOL transfer from your wallet — signed directly with your
            Privy wallet, not simulated.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="withdraw-address">Destination Solana Address</Label>
          <Input
            id="withdraw-address"
            placeholder="Recipient's devnet wallet address"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            disabled={sending}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="withdraw-amount">Amount (SOL)</Label>
          <Input
            id="withdraw-amount"
            type="number"
            step="0.0001"
            min={0}
            placeholder="e.g. 0.5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={sending}
          />
        </div>

        {signature && (
          <a
            href={explorerTxUrl(signature)}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline underline-offset-2"
          >
            View transaction on Solana Explorer <ExternalLink className="size-3" />
          </a>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            {sending ? <Loader2 className="animate-spin" /> : <ArrowUpFromLine />}
            {sending ? "Signing & sending…" : "Sign & Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
