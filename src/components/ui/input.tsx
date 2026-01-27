import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex w-full rounded-lg px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        // Dark theme (landing/marketing)
        default: "border border-landing-border bg-landing-bg-card text-landing-text placeholder:text-landing-text-muted focus:ring-primary-500",

        // Dark theme (app)
        dark: "border border-app-border bg-app-bg-input text-app-text placeholder:text-app-text-muted focus:ring-app-accent focus:border-app-accent",
      },
      inputSize: {
        sm: "h-9",
        md: "h-10",
        lg: "h-11",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "md",
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          inputVariants({ variant, inputSize }),
          error && "border-error focus:ring-error",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input, inputVariants }
