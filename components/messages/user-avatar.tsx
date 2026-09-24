import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function displayNameOf(user: { name: string | null; handle: string | null }) {
  return user.name ?? user.handle ?? "Collector";
}

export function UserAvatar({
  user,
  className,
}: {
  user: { name: string | null; handle: string | null; image: string | null };
  className?: string;
}) {
  const name = displayNameOf(user);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Avatar className={cn("shrink-0", className)}>
      {user.image && <AvatarImage src={user.image} alt={name} />}
      <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
    </Avatar>
  );
}
