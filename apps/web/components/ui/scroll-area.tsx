import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type ScrollAreaProps = ComponentProps<"div"> & {
  asChild?: boolean;
  overflow?: "auto" | "vertical" | "layout";
};

export function ScrollArea({
  asChild = false,
  overflow = "auto",
  className,
  ...props
}: ScrollAreaProps) {
  const Component = asChild ? Slot : "div";
  return (
    <Component
      {...props}
      data-overflow={overflow}
      className={cn("scroll-area", className)}
    />
  );
}
