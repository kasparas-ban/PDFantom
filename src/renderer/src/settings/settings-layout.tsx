import { useLayoutEffect, useRef, type ReactNode } from "react"

export function SettingsPageLayout({
  children,
  title,
}: {
  readonly children: ReactNode
  readonly title: string
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => heading.current?.focus({ preventScroll: true }), [title])

  return (
    <>
      <h1
        ref={heading}
        tabIndex={-1}
        className="mb-12 text-3xl font-semibold tracking-tight outline-none"
      >
        {title}
      </h1>
      <div className="space-y-10">{children}</div>
    </>
  )
}

export function SettingsSection({
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

export function SettingsCard({ children }: { readonly children: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">{children}</div>
}

export function SettingsRow({
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
          <p className="mt-0.5 max-w-xl text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
