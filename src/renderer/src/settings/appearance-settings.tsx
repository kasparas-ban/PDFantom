import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { useAppConfig } from "@/store/app-config-provider"
import type { Appearance } from "@/store/app-config-store"
import { SettingsPageLayout, SettingsSection } from "./settings-layout"

const appearanceOptions = [
  { icon: MonitorIcon, label: "System", value: "system" },
  { icon: SunIcon, label: "Light", value: "light" },
  { icon: MoonIcon, label: "Dark", value: "dark" },
] satisfies ReadonlyArray<{ icon: typeof MonitorIcon; label: string; value: Appearance }>

export function AppearanceSettings() {
  const appearance = useAppConfig((state) => state.appearance)
  const setAppearance = useAppConfig((state) => state.setAppearance)

  return (
    <SettingsPageLayout title="Appearance">
      <SettingsSection title="Theme">
        <RadioGroup
          aria-label="Theme"
          className="grid-cols-3"
          onValueChange={setAppearance}
          value={appearance}
        >
          {appearanceOptions.map(({ icon: Icon, label, value }) => (
            <label
              className={cn(
                "relative flex h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border bg-card text-sm font-medium text-card-foreground shadow-xs transition-[color,background-color,border-color,box-shadow,opacity,transform,translate,scale] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                appearance === value
                  ? "border-foreground/35 bg-accent ring-2 ring-foreground/10"
                  : "hover:bg-accent/60",
              )}
              key={value}
            >
              <RadioGroupItem className="absolute top-3 right-3" value={value} />
              <Icon className="size-6" />
              {label}
            </label>
          ))}
        </RadioGroup>
        <p className="mt-3 text-sm leading-5 text-muted-foreground">
          System follows the appearance selected in macOS.
        </p>
      </SettingsSection>
    </SettingsPageLayout>
  )
}
