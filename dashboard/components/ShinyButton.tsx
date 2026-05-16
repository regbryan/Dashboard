"use client";

import React from "react";
import { cn } from "@/lib/cn";

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
  /** Fill the parent container's width (e.g. inside a grid cell). */
  fullWidth?: boolean;
}

export const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, variant = "primary", fullWidth = false, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "sp-shiny",
          variant === "secondary" && "sp-shiny--secondary",
          className
        )}
        style={
          fullWidth
            ? { width: "100%", justifyContent: "center", ...style }
            : style
        }
        {...props}
      >
        <span className="sp-shiny__label">{children}</span>
      </button>
    );
  }
);

ShinyButton.displayName = "ShinyButton";
