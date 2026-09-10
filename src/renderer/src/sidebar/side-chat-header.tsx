import { useMemo, useState } from "react"
import { Loader2Icon, PlusIcon, XIcon } from "lucide-react"

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
import { cn } from "@/lib/utils"
import type { ChatThreadSummary } from "../../../shared/chat-thread-api"
import { usePlatform } from "../app/platform"
import { useAppConfig } from "../store/app-config-provider"
import { useChatThreads, useChatThreadStore } from "./chat-session"
import { isStreaming, sideChatsOf } from "./chat-thread-store"

export const SIDE_CHAT_DRAFT_TITLE = "Side chat"

type SideChatTab = {
  readonly id: string
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
  const skipConfirmation = useAppConfig((state) => state.skipSideChatCloseConfirmation)
  const setSkipConfirmation = useAppConfig((state) => state.setSkipSideChatCloseConfirmation)
  const [pendingClose, setPendingClose] = useState<ChatThreadSummary | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  const tabs = useMemo((): SideChatTab[] => {
    const stored = parentThreadId
      ? sideChatsOf(threads, parentThreadId).map((thread) => ({
          id: thread.id,
          title: thread.title,
          thread,
        }))
      : []
    if (!activeSideChat?.isDraft) return stored

    return [...stored, { id: activeSideChat.threadId, title: SIDE_CHAT_DRAFT_TITLE, thread: null }]
  }, [activeSideChat, parentThreadId, threads])

  const removeSideChat = (id: string) => {
    const state = threadStore.getState()
    const isLastTab =
      state.activeSideChat?.threadId === id &&
      !state.threads.some(
        (thread) => thread.parentThreadId === state.active?.threadId && thread.id !== id,
      )

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
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        role="tablist"
      >
        {tabs.map((tab) => (
          <SideChatTabItem
            isActive={tab.id === activeSideChat?.threadId}
            key={tab.id}
            onClose={() => requestClose(tab)}
            onOpen={() => {
              if (tab.thread) threadStore.getState().openSideChat(tab.thread)
            }}
            tab={tab}
          />
        ))}
      </div>
      <Button
        aria-label="New side chat"
        className="window-no-drag size-7 rounded-full text-muted-foreground"
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
  readonly isActive: boolean
  readonly onClose: () => void
  readonly onOpen: () => void
  readonly tab: SideChatTab
}

function SideChatTabItem({ isActive, onClose, onOpen, tab }: SideChatTabItemProps) {
  const isResponding = useChatThreads((state) => isStreaming(state, tab.id))

  return (
    <div
      className={cn(
        "group/tab flex h-8 shrink-0 items-center rounded-lg pr-0.5 text-muted-foreground hover:bg-sidebar-accent",
        isActive && "bg-sidebar-accent text-foreground",
      )}
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
