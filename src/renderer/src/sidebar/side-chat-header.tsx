import { useMemo, useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

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
import { sideChatsOf } from "./chat-thread-store"

export const SIDE_CHAT_DRAFT_TITLE = "Side chat"

type SideChatTab = {
  readonly id: string
  readonly title: string
  readonly thread: ChatThreadSummary | null
}

export function SideChatHeader() {
  const platform = usePlatform()
  const threadStore = useChatThreadStore()
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

  const closeSideChat = async (thread: ChatThreadSummary) => {
    setPendingClose(null)

    try {
      await platform.deleteChatThread(thread.id)
      threadStore.getState().removeSideChat(thread.id)
    } catch {}
  }

  const requestClose = ({ id, thread }: SideChatTab) => {
    if (!thread) {
      threadStore.getState().removeSideChat(id)
    } else if (skipConfirmation) {
      void closeSideChat(thread)
    } else {
      setDontAskAgain(false)
      setPendingClose(thread)
    }
  }

  return (
    <div className="window-drag-region flex h-12 shrink-0 items-center gap-1 pr-20 pl-3">
      <div
        aria-label="Side chats"
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeSideChat?.threadId

          return (
            <div
              className={cn(
                "group/tab flex h-8 shrink-0 items-center rounded-lg pr-0.5 text-muted-foreground hover:bg-sidebar-accent",
                isActive && "bg-sidebar-accent text-foreground",
              )}
              key={tab.id}
            >
              <button
                aria-selected={isActive}
                className="window-no-drag h-full max-w-36 cursor-pointer truncate rounded-md pr-1 pl-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => {
                  if (tab.thread) threadStore.getState().openSideChat(tab.thread)
                }}
                role="tab"
                title={tab.title}
                type="button"
              >
                {tab.title}
              </button>
              <Button
                aria-label={`Close ${tab.title}`}
                className="window-no-drag size-6 text-muted-foreground hover:text-foreground"
                onClick={() => requestClose(tab)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </div>
          )
        })}
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
