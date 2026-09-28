"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { startConversation } from "@/lib/actions";
import { useT } from "@/components/landing/language-provider";

// Opens (or reuses) the private thread with this user and jumps straight
// into it — used on the seller's store profile and the item page.
export function MessageSellerButton({
  sellerId,
  label,
  size = "sm",
  variant = "outline",
  className,
}: {
  sellerId: string;
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "outline" | "secondary" | "default";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useT();

  function open() {
    startTransition(async () => {
      try {
        const conversationId = await startConversation(sellerId);
        router.push(`/messages/${conversationId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not open the conversation."));
      }
    });
  }

  return (
    <Button type="button" size={size} variant={variant} className={className} onClick={open} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <MessageCircle />}
      {label ?? t("Message Seller")}
    </Button>
  );
}
