import { CircleCheckIcon, FileLock2Icon } from "lucide-react"

import { SettingsCard, SettingsPageLayout, SettingsRow, SettingsSection } from "./settings-layout"

export function GeneralSettings() {
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
