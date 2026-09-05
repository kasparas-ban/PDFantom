import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react"

const PagePortalContainerContext = createContext<HTMLElement | null>(null)
export const usePagePortalContainer = () => useContext(PagePortalContainerContext)

export function PageSurface({ children, ...props }: ComponentProps<"main">) {
  const pageRef = useRef<HTMLElement>(null)
  const lastFocusedElement = useRef<HTMLElement | null>(null)
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const page = pageRef.current
    if (!page) return

    const previous = lastFocusedElement.current
    const target =
      previous?.isConnected && previous.checkVisibility()
        ? previous
        : (page.querySelector<HTMLElement>("h1[tabindex]") ?? page)

    target.focus({ preventScroll: true })

    const rememberFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && !event.target.closest('[role="menu"]')) {
        lastFocusedElement.current = event.target
      }
    }

    page.addEventListener("focusin", rememberFocus)

    return () => page.removeEventListener("focusin", rememberFocus)
  }, [])

  return (
    <main ref={pageRef} tabIndex={-1} {...props}>
      <PagePortalContainerContext value={portalContainer}>
        {children}
        <div ref={setPortalContainer} data-page-portals="" />
      </PagePortalContainerContext>
    </main>
  )
}
