import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_0.5px_0_rgba(255,255,255,0.28),0_4px_12px_-3px_rgba(0,0,0,0.18)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.12),0_4px_12px_-2px_rgba(0,0,0,0.45)] hover:brightness-105",
        destructive:
          "bg-destructive text-white shadow-[inset_0_0.5px_0_rgba(255,255,255,0.26),0_4px_12px_-3px_rgba(255,59,48,0.32)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.12),0_4px_12px_-2px_rgba(0,0,0,0.45)] hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/80",
        outline:
          "bg-clip-padding border border-black/[0.08] dark:border-white/[0.09] bg-white/82 dark:bg-white/[0.07] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_2px_6px_-1px_rgba(15,23,42,0.06)] dark:shadow-[0_2px_6px_-1px_rgba(0,0,0,0.35)] hover:bg-white dark:hover:bg-white/[0.12] text-foreground",
        secondary:
          "bg-clip-padding bg-white/75 dark:bg-white/[0.08] text-secondary-foreground backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none hover:bg-white dark:hover:bg-white/[0.13]",
        ghost: "hover:bg-black/[0.05] dark:hover:bg-white/[0.08] rounded-full",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 rounded-full px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-8 rounded-full gap-1.5 px-3.5 has-[>svg]:px-3",
        lg: "h-10 rounded-full px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-full",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
