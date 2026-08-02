import { type ReactNode, useState } from "react"
import {
  ArrowLeftIcon,
  CircleCheckIcon,
  FileLock2Icon,
  InfoIcon,
  KeyRoundIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react"

import { PdfantomLogo } from "@/components/pdfantom-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { useAppConfig } from "@/store/app-config-provider"
import type { Appearance } from "@/store/app-config-store"

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

function GeneralSettings() {
  return (
    <SettingsPageLayout title="General">
      <SettingsSection title="Privacy">
        <SettingsCard>
          <SettingsRow
            description="PDFantom only reads PDFs you explicitly open. Your documents stay on this Mac."
            icon={<FileLock2Icon />}
            title="Local document access"
          >
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
              Enabled
            </span>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </SettingsPageLayout>
  )
}

function ProviderSettings() {
  return (
    <SettingsPageLayout title="AI Provider">
      <SettingsSection title="OpenRouter">
        <SettingsCard>
          <div className="p-5">
            <label className="text-sm font-medium" htmlFor="openrouter-api-key">
              API key
            </label>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Enter your OpenRouter API key to use OpenRouter models in chat.
            </p>
            <Input
              autoComplete="off"
              className="mt-4 max-w-lg bg-background"
              id="openrouter-api-key"
              placeholder="sk-or-v1-…"
              type="password"
            />
          </div>
        </SettingsCard>
      </SettingsSection>
    </SettingsPageLayout>
  )
}

const appearanceOptions = [
  { icon: MonitorIcon, label: "System", value: "system" },
  { icon: SunIcon, label: "Light", value: "light" },
  { icon: MoonIcon, label: "Dark", value: "dark" },
] satisfies ReadonlyArray<{ icon: typeof MonitorIcon; label: string; value: Appearance }>

function AppearanceSettings() {
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
                "relative flex h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border bg-card text-sm font-medium text-card-foreground shadow-xs transition-all focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
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

function AboutSettings() {
  return (
    <SettingsPageLayout title="About">
      <SettingsSection title="PDFantom">
        <SettingsCard>
          <div className="flex items-center gap-4 p-5">
            <PdfantomLogo aria-hidden="true" className="size-14" />
            <div>
              <h2 className="font-medium">PDFantom</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A secure, local-first PDF reader for macOS.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Version 0.1.0</p>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>
    </SettingsPageLayout>
  )
}

function SettingsPageLayout({
  children,
  title,
}: {
  readonly children: ReactNode
  readonly title: string
}) {
  return (
    <>
      <h1 className="mb-12 text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="space-y-10">{children}</div>
    </>
  )
}

function SettingsSection({
  children,
  title,
}: {
  readonly children: ReactNode
  readonly title: string
}) {
  return (
    <section>
      <h2 className="mb-3 text-base font-medium">{title}</h2>
      {children}
    </section>
  )
}

function SettingsCard({ children }: { readonly children: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">{children}</div>
}

function SettingsRow({
  children,
  description,
  icon,
  title,
}: {
  readonly children: ReactNode
  readonly description: string
  readonly icon?: ReactNode
  readonly title: string
}) {
  return (
    <div className="flex min-h-20 items-center justify-between gap-6 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 text-muted-foreground">{icon}</div>}
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-0.5 max-w-xl text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
