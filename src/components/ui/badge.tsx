import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium transition-colors",
  {
    variants: {
      variant: {
        default:    "border-transparent bg-primary text-primary-foreground",
        secondary:  "border-[#232328] bg-[#17171A] text-[#8A8A95]",
        outline:    "border-[#232328] text-[#6B6B78]",
        warning:    "border-[rgba(240,164,41,0.2)] bg-[rgba(240,164,41,0.10)] text-[#F0A429]",
        success:    "border-[rgba(45,212,160,0.2)] bg-[rgba(45,212,160,0.10)] text-[#2DD4A0]",
        danger:     "border-[rgba(240,96,96,0.2)] bg-[rgba(240,96,96,0.10)] text-[#F06060]",
        article:    "border-[rgba(124,111,247,0.2)] bg-[rgba(124,111,247,0.08)] text-[#A99DF9]",
        reply:      "border-[rgba(45,212,160,0.2)] bg-[rgba(45,212,160,0.06)] text-[#2DD4A0]",
        listing:    "border-[rgba(240,164,41,0.2)] bg-[rgba(240,164,41,0.08)] text-[#F0A429]",
        outreach:   "border-[rgba(240,96,96,0.2)] bg-[rgba(240,96,96,0.08)] text-[#F06060]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
