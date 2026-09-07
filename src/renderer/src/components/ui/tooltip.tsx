import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

type TooltipProps = TooltipPrimitive.Root.Props & Pick<TooltipPrimitive.Provider.Props, "delay">

function Tooltip({ delay, ...props }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delay={delay}>
      <TooltipPrimitive.Root {...props} />
    </TooltipPrimitive.Provider>
  )
}

const TooltipTrigger = TooltipPrimitive.Trigger

function TooltipContent({ className, ...props }: TooltipPrimitive.Popup.Props) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner className="isolate z-50 outline-none" side="top" sideOffset={6}>
        <TooltipPrimitive.Popup
          className={cn(
            "origin-(--transform-origin) rounded-lg bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          data-slot="tooltip-content"
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipTrigger }
