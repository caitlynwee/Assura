import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

/** shadcn/ui Spinner (lucide loader). Default export kept for existing call sites. */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("size-5 animate-spin text-primary", className)}
      {...props}
    />
  );
}

export { Spinner };
export default Spinner;
