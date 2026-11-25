"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        // --z-modal-backdrop (300), matching dialog.tsx. At the old z-50 this scrim
        // lost to the sidebar's --z-sidebar (250) and dimmed the content while
        // leaving the nav lit — see CommandPalette.tsx for the measured case.
        "fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 next:bg-scrim",
        className
      )}
      {...props}
    />
  )
}

/**
 * The grab handle as a control (new look): a 28 tall band across the sheet with the handle 10 down it
 * (where it is drawn). A tap, or a pull down of 24 or more that starts on it, dismisses. Pointer only:
 * Escape is the keyboard's way, and the band stays hidden from assistive tech.
 *
 * Why 28 tall and not `tap-44`: the band spans the sheet's full width, is for a pointer only, and sits
 * directly under the scrim, which dismisses too, so the area that closes the sheet is far larger than
 * 44; Escape closes it from the keyboard. A taller band would make taps on the title's top edge close
 * the sheet.
 */
function SheetHandleZone({ onDismiss }: { onDismiss: () => void }) {
  const startY = React.useRef<number | null>(null)
  // A drag that dismissed: pointer capture makes the band the target of its `pointerup`, so the browser
  // then fires `click` on it too. That click is the same gesture, not a second dismissal.
  const dragDismissed = React.useRef(false)
  return (
    <div
      data-slot="sheet-handle-zone"
      aria-hidden
      onPointerDown={(e) => {
        startY.current = e.clientY
        dragDismissed.current = false
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }}
      onPointerUp={(e) => {
        const from = startY.current
        startY.current = null
        if (from !== null && e.clientY - from >= 24) {
          dragDismissed.current = true
          onDismiss()
        }
      }}
      onClick={() => {
        if (dragDismissed.current) {
          dragDismissed.current = false
          return
        }
        onDismiss()
      }}
      className="flex h-7 w-full shrink-0 cursor-grab touch-none justify-center"
    >
      <div data-slot="sheet-handle" className="mt-2.5 h-[5px] w-[38px] rounded-full bg-foreground-muted/50" />
    </div>
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  onHandleDismiss,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  /** New look, bottom sheet: a tap on the grab handle, or a pull down from it, dismisses. */
  onHandleDismiss?: () => void
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          // --z-modal (400), above its own backdrop (300) and above the chrome.
          "fixed z-[var(--z-modal)] flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
          // Next look (spec §4.5, §7): card surface, slides over 300ms on ease-out-quart.
          "next:bg-surface next:ease-[var(--ease-out-quart)] next:data-[state=open]:duration-300",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom next:rounded-t-4xl next:border-t-0 next:shadow-[var(--shadow-sheet)]",
          className
        )}
        {...props}
      >
        {NEW_LOOK_ENABLED && side === "bottom" &&
          (onHandleDismiss ? (
            <SheetHandleZone onDismiss={onHandleDismiss} />
          ) : (
            <div
              data-slot="sheet-handle"
              aria-hidden
              className="mx-auto mt-2 h-[5px] w-[38px] shrink-0 rounded-full bg-foreground-muted/50"
            />
          ))}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
