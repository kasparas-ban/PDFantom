import { PdfantomLogo } from "@/components/pdfantom-logo"
import { SettingsCard, SettingsPageLayout, SettingsSection } from "./settings-layout"

export function AboutSettings() {
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
