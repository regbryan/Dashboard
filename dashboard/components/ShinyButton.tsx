"use client";

import React from "react";
import { cn } from "@/lib/cn";

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
}

export const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "sp-shiny",
          variant === "secondary" && "sp-shiny--secondary",
          className
        )}
        {...props}
      >
        <span className="sp-shiny__label">{children}</span>
      </button>
    );
  }
);

ShinyButton.displayName = "ShinyButton";
