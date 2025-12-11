import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md px-3 py-2 text-base ring-offset-background transition-all duration-300 font-sans",
          "bg-muted/30 border-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0 focus-visible:bg-background focus-visible:shadow-[inset_0_1px_2px_rgba(0,0,0,0.04),0_0_0_3px_hsl(var(--ring)/0.1)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:ring-destructive",
          "md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
