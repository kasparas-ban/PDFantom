import { ArrowLeftIcon, InfoIcon, KeyRoundIcon, MonitorIcon, SettingsIcon } from "lucide-react"
import { Link, NavLink, Outlet } from "react-router"

import { buttonVariants } from "@/components/ui/button"
import { PageSurface } from "../app/page-surface"

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
  page: string
}>

export function SettingsView() {
  return (
    <PageSurface
      aria-label="Settings"
      className="flex h-screen min-h-0 bg-background text-foreground"
    >
      <aside className="flex w-68 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 pb-5">
        <div aria-hidden="true" className="window-drag-region h-12 shrink-0" />
        <Link
          to="/"
          className={buttonVariants({
            className: "mb-6 w-fit justify-start px-2 text-muted-foreground",
            variant: "ghost",
          })}
        >
          <ArrowLeftIcon />
          Back to app
        </Link>

        <p className="mb-1.5 px-2 text-xs font-medium text-muted-foreground">PDFantom</p>
        <nav aria-label="Settings sections" className="space-y-1">
          {navigationItems.map(({ icon: Icon, label, page }) => (
            <NavLink
              to={page}
              className={buttonVariants({
                className:
                  "w-full justify-start px-2.5 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground",
                variant: "ghost",
              })}
              key={page}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto">
        <div aria-hidden="true" className="window-drag-region h-12" />
        <div className="mx-auto w-full max-w-3xl px-10 pt-6 pb-16">
          <Outlet />
        </div>
      </section>
    </PageSurface>
  )
}
