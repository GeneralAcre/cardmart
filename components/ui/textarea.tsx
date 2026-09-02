import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input flex min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-2",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
