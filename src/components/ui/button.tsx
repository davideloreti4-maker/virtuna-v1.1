"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Landing/Marketing variants (dark theme)
        primary: "bg-[#E57850] text-white hover:bg-[#d46a45] focus-visible:ring-[#E57850]",
        secondary: "bg-white/10 text-landing-text hover:bg-white/20 focus-visible:ring-white/50",
        outline: "border border-landing-border bg-transparent text-landing-text hover:bg-white/5 focus-visible:ring-white/50",
        ghost: "text-landing-text-muted hover:bg-white/10 hover:text-landing-text focus-visible:ring-white/50",
        link: "text-[#F97316] underline-offset-4 hover:underline focus-visible:ring-[#F97316]",

        // App variants (dark theme)
        "app-primary": "bg-white text-gray-900 hover:bg-gray-100 focus-visible:ring-white",
        "app-secondary": "bg-app-bg-card text-app-text border border-app-border hover:bg-app-bg-input focus-visible:ring-app-accent",
        "app-ghost": "text-app-text-muted hover:text-app-text hover:bg-white/5 focus-visible:ring-app-accent",
        "app-accent": "bg-app-accent text-white hover:bg-app-accent-hover focus-visible:ring-app-accent",

        // Danger
        danger: "bg-error text-white hover:bg-red-600 focus-visible:ring-error",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        xl: "h-12 px-8 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
      rounded: {
        default: "rounded-lg",
        full: "rounded-full",
        none: "rounded-none",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      rounded: "default",
    },
  }
)

export interface ButtonProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      | "onDrag"
      | "onDragStart"
      | "onDragEnd"
      | "onAnimationStart"
      | "onDragCapture"
      | "onDragEndCapture"
      | "onDragEnter"
      | "onDragEnterCapture"
      | "onDragExit"
      | "onDragExitCapture"
      | "onDragLeave"
      | "onDragLeaveCapture"
      | "onDragOver"
      | "onDragOverCapture"
      | "onDragStartCapture"
      | "onDrop"
      | "onDropCapture"
    >,
    VariantProps<typeof buttonVariants> {
  fullWidth?: boolean;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, rounded, fullWidth, asChild, ...props }, ref) => {
    const classes = cn(
      buttonVariants({ variant, size, rounded }),
      fullWidth && "w-full",
      className
    )

    if (asChild) {
      return (
        <Slot
          className={classes}
          ref={ref}
          {...props}
        />
      )
    }

    return (
      <motion.button
        className={classes}
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        {...(props as React.ComponentProps<typeof motion.button>)}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
