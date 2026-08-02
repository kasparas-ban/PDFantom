import { useState } from "react"
import {
  ArrowLeftIcon,
  InfoIcon,
  KeyRoundIcon,
  MonitorIcon,
  SettingsIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAppConfig } from "@/store/app-config-provider"
import { AboutSettings } from "./about-settings"
import { AppearanceSettings } from "./appearance-settings"
import { GeneralSettings } from "./general-settings"
import { ProviderSettings } from "./provider-settings"

type SettingsPage = "about" | "appearance" | "general" | "provider"

const navigationItems = [
  {
    icon: SettingsIcon,
    label: "General",
    page: "general",
  },
  {
    icon: MonitorIcon,
    label: "Appearance",
    page: "appearance",
  },
  {
    icon: KeyRoundIcon,
    label: "AI Provider",
    page: "provider",
  },
  {
    icon: InfoIcon,
    label: "About",
    page: "about",
  },
] satisfies ReadonlyArray<{
  icon: typeof SettingsIcon
  label: string
  page: SettingsPage
}>

export function SettingsView() {
  const closeSettings = useAppConfig((state) => state.closeSettings)
  const [activePage, setActivePage] = useState<SettingsPage>("general")

  return (
    <main
      aria-label="Settings"
      className="flex h-screen min-h-0 bg-background text-foreground"
    >
      <aside className="flex w-68 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 pb-5">
        <div aria-hidden="true" className="window-drag-region h-12 shrink-0" />
        <Button
          className="mb-6 w-fit justify-start px-2 text-muted-foreground"
          onClick={closeSettings}
          type="button"
          variant="ghost"
        >
          <ArrowLeftIcon />
          Back to app
        </Button>

        <p className="mb-1.5 px-2 text-xs font-medium text-muted-foreground">PDFantom</p>
        <nav aria-label="Settings sections" className="space-y-1">
          {navigationItems.map(({ icon: Icon, label, page }) => (
            <Button
              aria-current={activePage === page ? "page" : undefined}
              className={cn(
                "w-full justify-start px-2.5 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground",
                activePage === page && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
              key={page}
              onClick={() => setActivePage(page)}
              type="button"
              variant="ghost"
            >
              <Icon />
              {label}
            </Button>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto">
        <div aria-hidden="true" className="window-drag-region h-12" />
        <div className="mx-auto w-full max-w-3xl px-10 pt-6 pb-16">
          {activePage === "general" && <GeneralSettings />}
          {activePage === "appearance" && <AppearanceSettings />}
          {activePage === "provider" && <ProviderSettings />}
          {activePage === "about" && <AboutSettings />}
        </div>
      </section>
    </main>
  )
}
