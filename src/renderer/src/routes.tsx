import { Link, Navigate, type RouteObject } from "react-router"

import { AppShell } from "./app-shell"
import { buttonVariants } from "./components/ui/button"
import { PageSurface } from "./page-surface"
import { AboutSettings } from "./settings/about-settings"
import { AppearanceSettings } from "./settings/appearance-settings"
import { GeneralSettings } from "./settings/general-settings"
import { ProviderSettings } from "./settings/provider-settings"
import { SettingsView } from "./settings/settings-view"

export const routes: RouteObject[] = [
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, id: "reader" },
      {
        path: "settings",
        Component: SettingsView,
        children: [
          { index: true, element: <Navigate to="general" replace /> },
          { path: "general", Component: GeneralSettings },
          { path: "appearance", Component: AppearanceSettings },
          { path: "provider", Component: ProviderSettings },
          { path: "about", Component: AboutSettings },
        ],
      },
      { path: "*", Component: NotFound },
    ],
  },
]

function NotFound() {
  return (
    <PageSurface
      aria-label="Page not found"
      className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground outline-none"
    >
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className={buttonVariants({})}>
        Back to app
      </Link>
    </PageSurface>
  )
}
