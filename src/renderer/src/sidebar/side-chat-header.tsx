import { useCallback, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react"
import { ChevronDownIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { ChatThreadSummary } from "../../../shared/chat-thread-api"
import { usePlatform } from "../app/platform"
import { useAppConfig } from "../store/app-config-provider"
import { useChatThreads, useChatThreadStore } from "./chat-session"
import { isStreaming, sideChatTargetsOf, type ChatThreadTarget } from "./chat-thread-store"

export const SIDE_CHAT_DRAFT_TITLE = "Side chat"

type SideChatTab = {
  readonly id: string
  readonly target: ChatThreadTarget
  readonly title: string
  readonly thread: ChatThreadSummary | null
}

export function SideChatHeader() {
  const platform = usePlatform()
  const threadStore = useChatThreadStore()
  const setSideChatPanelOpen = useAppConfig((state) => state.setSideChatPanelOpen)
  const parentThreadId = useChatThreads((state) => state.active?.threadId ?? null)
  const activeSideChat = useChatThreads((state) => state.activeSideChat)
  const threads = useChatThreads((state) => state.threads)
  const sideChatDrafts = useChatThreads((state) => state.sideChatDrafts)
  const skipConfirmation = useAppConfig((state) => state.skipSideChatCloseConfirmation)
  const setSkipConfirmation = useAppConfig((state) => state.setSkipSideChatCloseConfirmation)
  const [pendingClose, setPendingClose] = useState<ChatThreadSummary | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const activeTabRef = useRef<HTMLDivElement>(null)

  const tabs = useMemo((): SideChatTab[] => {
    if (!parentThreadId) return []

    return sideChatTargetsOf({ threads, sideChatDrafts }, parentThreadId).map((target) => {
      const thread = threads.find((stored) => stored.id === target.threadId) ?? null

      return { id: target.threadId, target, title: thread?.title ?? SIDE_CHAT_DRAFT_TITLE, thread }
    })
  }, [parentThreadId, threads, sideChatDrafts])

  const revealActiveTab = useCallback(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [])

  useLayoutEffect(revealActiveTab, [activeSideChat?.threadId, revealActiveTab])

  const openSideChat = (tab: SideChatTab) => {
    if (tab.id === activeSideChat?.threadId) revealActiveTab()
    threadStore.getState().openSideChat(tab.target)
  }

  const removeSideChat = (id: string) => {
    const state = threadStore.getState()
    const isLastTab =
      state.activeSideChat?.threadId === id &&
      state.active !== null &&
      sideChatTargetsOf(state, state.active.threadId).length === 1

    state.removeSideChat(id)
    if (isLastTab) setSideChatPanelOpen(false)
  }

  const closeSideChat = async (thread: ChatThreadSummary) => {
    setPendingClose(null)

    try {
      await platform.deleteChatThread(thread.id)
      removeSideChat(thread.id)
    } catch {}
  }

  const requestClose = ({ id, thread }: SideChatTab) => {
    if (!thread) {
      removeSideChat(id)
    } else if (skipConfirmation) {
      void closeSideChat(thread)
    } else {
      setDontAskAgain(false)
      setPendingClose(thread)
    }
  }

  return (
    <div className="window-drag-region flex h-12 shrink-0 items-center gap-1 pr-12 pl-3">
      <div
        aria-label="Side chats"
        className="window-no-drag flex min-w-0 flex-1 scrollbar-none items-center gap-0.5 overflow-x-auto"
        role="tablist"
      >
        {tabs.map((tab) => (
          <SideChatTabItem
            isActive={tab.id === activeSideChat?.threadId}
            key={tab.id}
            onClose={() => requestClose(tab)}
            onOpen={() => openSideChat(tab)}
            ref={tab.id === activeSideChat?.threadId ? activeTabRef : null}
            tab={tab}
          />
        ))}
      </div>
      {tabs.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="All side chats"
                className="window-no-drag shrink-0 text-muted-foreground"
                size="icon-sm"
                title="All side chats"
                variant="ghost"
              />
            }
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" aria-label="All side chats" className="max-w-80">
            <DropdownMenuRadioGroup value={activeSideChat?.threadId ?? ""}>
              {tabs.map((tab, index) => (
                <DropdownMenuRadioItem
                  closeOnClick
                  key={tab.id}
                  onClick={() => openSideChat(tab)}
                  value={tab.id}
                >
                  <span className="shrink-0 text-muted-foreground">{index + 1}.</span>
                  <span className="min-w-0 wrap-anywhere">{tab.title}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button
        aria-label="New side chat"
        className="window-no-drag size-7 shrink-0 rounded-full text-muted-foreground"
        onClick={() => threadStore.getState().startSideChatDraft()}
        size="icon-sm"
        title="New side chat"
        type="button"
        variant="ghost"
      >
        <PlusIcon />
      </Button>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setPendingClose(null)
        }}
        open={pendingClose !== null}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Close side chat?</AlertDialogTitle>
          <AlertDialogDescription>
            This side chat will be gone and can't be recovered. Are you sure?
          </AlertDialogDescription>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={dontAskAgain}
              id="skip-side-chat-close-confirmation"
              onCheckedChange={setDontAskAgain}
            />
            <label className="text-sm" htmlFor="skip-side-chat-close-confirmation">
              Don't ask again
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={() => {
                if (dontAskAgain) setSkipConfirmation(true)
                if (pendingClose) void closeSideChat(pendingClose)
              }}
              type="button"
              variant="destructive"
            >
              Close side chat
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

type SideChatTabItemProps = {
  readonly ref: Ref<HTMLDivElement>
  readonly isActive: boolean
  readonly onClose: () => void
  readonly onOpen: () => void
  readonly tab: SideChatTab
}

function SideChatTabItem({ isActive, onClose, onOpen, ref, tab }: SideChatTabItemProps) {
  const isResponding = useChatThreads((state) => isStreaming(state, tab.id))

  return (
    <div
      className={cn(
        "group/tab flex h-8 shrink-0 items-center rounded-lg pr-0.5 text-muted-foreground hover:bg-sidebar-accent",
        isActive && "bg-sidebar-accent text-foreground",
      )}
      ref={ref}
    >
      <button
        aria-selected={isActive}
        className="window-no-drag h-full max-w-36 cursor-pointer truncate rounded-md pr-1 pl-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={onOpen}
        role="tab"
        title={tab.title}
        type="button"
      >
        {tab.title}
      </button>
      <div className="relative flex size-6 shrink-0 items-center justify-center">
        {isResponding && (
          <output
            aria-label="Responding"
            className="pointer-events-none absolute inset-0 flex items-center justify-center group-focus-within/tab:opacity-0 group-hover/tab:opacity-0"
          >
            <Loader2Icon aria-hidden="true" className="size-3.5 animate-spin text-primary" />
          </output>
        )}
        <Button
          aria-label={`Close ${tab.title}`}
          className={cn(
            "window-no-drag size-6 text-muted-foreground hover:text-foreground",
            isResponding &&
              "opacity-0 group-focus-within/tab:opacity-100 group-hover/tab:opacity-100",
          )}
          onClick={onClose}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  )
}
