import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "bg-[#7C6FF7] text-white hover:bg-[#6B5EE4] rounded-[7px]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-[7px]",
        secondary:   "bg-[#17171A] text-[#E8E8EC] border border-[#232328] hover:bg-[#1D1D21] rounded-[7px]",
        outline:     "bg-transparent text-[#E8E8EC] border border-[#232328] hover:bg-[#1D1D21] rounded-[7px]",
        ghost:       "bg-transparent text-[#8A8A95] hover:bg-[#17171A] hover:text-[#E8E8EC] rounded-[7px]",
      },
      size: {
        default: "h-9 px-4 text-[13px]",
        sm:      "h-8 px-3 text-[12px]",
        icon:    "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
