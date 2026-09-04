import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react"

const PagePortalContext = createContext<HTMLElement | null>(null)
export const usePagePortal = () => useContext(PagePortalContext)

export function PageSurface({ children, ...props }: ComponentProps<"main">) {
  const root = useRef<HTMLElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)
  const [portal, setPortal] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const page = root.current!
    const previous = lastFocus.current
    const target =
      previous?.isConnected && previous.checkVisibility()
        ? previous
        : (page.querySelector<HTMLElement>("h1[tabindex]") ?? page)
    target.focus({ preventScroll: true })
    const rememberFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && !event.target.closest('[role="menu"]')) {
        lastFocus.current = event.target
      }
    }
    page.addEventListener("focusin", rememberFocus)
    return () => page.removeEventListener("focusin", rememberFocus)
  }, [])

  return (
    <main ref={root} tabIndex={-1} {...props}>
      <PagePortalContext value={portal}>
        {children}
        <div ref={setPortal} data-page-portals="" />
      </PagePortalContext>
    </main>
  )
}
