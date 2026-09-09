import { useEffect, useMemo, useRef, useState } from "react"
import {
  FilePlus2,
  FolderClosed,
  FolderOpen,
  Loader2Icon,
  MoreHorizontalIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAppConfig } from "@/store/app-config-provider"
import { useReaderSession } from "@/store/reader-session-provider"
import pdfantomLogo from "../../../../assets/pdfantom-logo.svg?no-inline"
import type { ChatThreadSummary } from "../../../shared/chat-thread-api"
import type { DocumentSummary } from "../../../shared/document-api"
import { usePlatform } from "../app/platform"
import { useChatThreads, useChatThreadStore } from "./chat-session"
import { isStreamingWithin, threadsOfDocument, visibleThreadsOfDocument } from "./chat-thread-store"

type DocumentsPanelProps = {
  readonly onActivateDocument: (documentId: string) => void
  readonly onOpenDocument: () => void
}

export function DocumentsPanel({ onActivateDocument, onOpenDocument }: DocumentsPanelProps) {
  const platform = usePlatform()
  const documents = useReaderSession((state) => state.documents)
  const isDocumentLibraryHydrated = useReaderSession((state) => state.isDocumentLibraryHydrated)
  const threadStore = useChatThreadStore()
  const openChatPanel = useAppConfig((state) => state.openChatPanel)
  const [pendingDelete, setPendingDelete] = useState<ChatThreadSummary | null>(null)

  useExpandOnSelection()

  const openThread = (thread: ChatThreadSummary) => {
    threadStore.getState().openThread(thread)
    onActivateDocument(thread.documentId)
    openChatPanel()
  }

  const startThread = (documentId: string) => {
    threadStore.getState().startDraft(documentId)
    onActivateDocument(documentId)
    openChatPanel()
  }

  const deleteThread = async (thread: ChatThreadSummary) => {
    setPendingDelete(null)

    try {
      await platform.deleteChatThread(thread.id)
      threadStore.getState().removeThread(thread.id)
    } catch {}
  }

  return (
    <aside
      aria-label="Documents panel"
      className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[inset_-1px_0_rgb(255_255_255/28%)]"
      id="documents-panel"
    >
      <div aria-label="Window drag area" className="window-drag-region h-12 shrink-0" />

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        <div className="mb-3 flex items-center gap-2 px-1">
          <img alt="" className="size-8 rounded-md" src={pdfantomLogo} />
          <h1 className="text-base font-semibold">PDFantom</h1>
        </div>

        <nav aria-label="Primary" className="space-y-0.5 font-semibold text-gray-600">
          <Button
            className="w-full justify-start gap-2 px-2 hover:bg-sidebar-accent"
            disabled={!isDocumentLibraryHydrated}
            onClick={onOpenDocument}
            type="button"
            variant="ghost"
          >
            <FilePlus2 />
            Open PDF
          </Button>
        </nav>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <p className="text-base font-semibold text-gray-400">Documents</p>
          </div>
          {documents.length > 0 ? (
            <nav aria-label="Documents">
              <ul className="space-y-0.5">
                {documents.map((document) => (
                  <DocumentRow
                    document={document}
                    key={document.id}
                    onActivate={() => onActivateDocument(document.id)}
                    onDeleteThread={setPendingDelete}
                    onOpenThread={openThread}
                    onStartThread={() => startThread(document.id)}
                  />
                ))}
              </ul>
            </nav>
          ) : (
            <div className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">
              {isDocumentLibraryHydrated ? "Open a PDF to begin reading." : "Loading documents…"}
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        open={pendingDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete this chat thread?</AlertDialogTitle>
          <AlertDialogDescription>
            “{pendingDelete?.title}” and all of its messages will be removed. This cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={() => {
                if (pendingDelete) void deleteThread(pendingDelete)
              }}
              type="button"
              variant="destructive"
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}

function useExpandOnSelection() {
  const selectedDocumentId = useReaderSession((state) => state.selectedDocument?.id ?? null)
  const expandDocumentChatThreads = useAppConfig((state) => state.expandDocumentChatThreads)
  const previousSelectedDocumentId = useRef<string | null>(null)

  useEffect(() => {
    const previous = previousSelectedDocumentId.current
    previousSelectedDocumentId.current = selectedDocumentId

    if (selectedDocumentId && previous && previous !== selectedDocumentId) {
      expandDocumentChatThreads(selectedDocumentId)
    }
  }, [expandDocumentChatThreads, selectedDocumentId])
}

type DocumentRowProps = {
  readonly document: DocumentSummary
  readonly onActivate: () => void
  readonly onDeleteThread: (thread: ChatThreadSummary) => void
  readonly onOpenThread: (thread: ChatThreadSummary) => void
  readonly onStartThread: () => void
}

function DocumentRow({
  document,
  onActivate,
  onDeleteThread,
  onOpenThread,
  onStartThread,
}: DocumentRowProps) {
  const activeDocument = useReaderSession((state) => state.activeDocument)
  const selectedDocument = useReaderSession((state) => state.selectedDocument)
  const isCollapsed = useAppConfig((state) => state.collapsedDocumentIds.includes(document.id))
  const toggleDocumentChatThreads = useAppConfig((state) => state.toggleDocumentChatThreads)
  const isRevealed = useChatThreads((state) => state.revealedDocumentIds.includes(document.id))
  const toggleRevealed = useChatThreads((state) => state.toggleRevealed)
  const activeThreadId = useChatThreads((state) => state.active?.threadId ?? null)
  const threads = useChatThreads((state) => state.threads)
  const { visible, hidden } = useMemo(
    () => visibleThreadsOfDocument(threads, document.id, activeThreadId, isRevealed),
    [activeThreadId, document.id, isRevealed, threads],
  )
  const threadCount = threadsOfDocument(threads, document.id).length
  const isActive = activeDocument.status !== "none" && activeDocument.document.id === document.id
  const isExpanded = !isCollapsed && threadCount > 0

  return (
    <li
      className={cn(
        "text-sidebar-foreground/65 transition-colors",
        isActive && "text-sidebar-foreground",
      )}
    >
      <div
        className={cn(
          "group/document flex h-8 items-center gap-0.5 rounded-lg pr-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "font-medium",
        )}
      >
        <Button
          aria-controls={threadCount > 0 ? `chat-threads-${document.id}` : undefined}
          aria-expanded={isExpanded}
          aria-label={`${isCollapsed ? "Expand" : "Collapse"} chat threads for ${document.name}`}
          className="size-8 shrink-0 rounded-lg text-current hover:bg-transparent hover:text-current aria-expanded:bg-transparent aria-expanded:text-current"
          disabled={threadCount === 0}
          onClick={() => toggleDocumentChatThreads(document.id)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {isExpanded ? <FolderOpen className="size-4" /> : <FolderClosed className="size-4" />}
        </Button>
        <button
          aria-busy={(selectedDocument?.id === document.id && !isActive) || undefined}
          aria-current={isActive ? "page" : undefined}
          className="h-full min-w-0 flex-1 cursor-pointer truncate rounded-md text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          data-slot="document-entry"
          onClick={onActivate}
          title={document.name}
          type="button"
        >
          {document.name}
        </button>
        <Button
          aria-label={`New chat thread in ${document.name}`}
          className="size-6 shrink-0 text-muted-foreground opacity-0 group-hover/document:opacity-100 focus-visible:opacity-100"
          onClick={onStartThread}
          size="icon-xs"
          title="New chat thread"
          type="button"
          variant="ghost"
        >
          <SquarePenIcon />
        </Button>
      </div>

      {isExpanded && (
        <ul
          aria-label={`Chat threads for ${document.name}`}
          className="mt-0.5 space-y-0.5"
          id={`chat-threads-${document.id}`}
        >
          {visible.map((thread) => (
            <ChatThreadRow
              isActive={thread.id === activeThreadId}
              key={thread.id}
              onDelete={() => onDeleteThread(thread)}
              onOpen={() => onOpenThread(thread)}
              thread={thread}
            />
          ))}
          {(hidden > 0 || isRevealed) && (
            <li>
              <button
                className="h-7 w-full cursor-pointer rounded-lg pl-8 text-left text-sm text-muted-foreground hover:text-foreground"
                onClick={() => toggleRevealed(document.id)}
                type="button"
              >
                {isRevealed ? "Show less" : "Show more"}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

type ChatThreadRowProps = {
  readonly isActive: boolean
  readonly onDelete: () => void
  readonly onOpen: () => void
  readonly thread: ChatThreadSummary
}

function ChatThreadRow({ isActive, onDelete, onOpen, thread }: ChatThreadRowProps) {
  const isResponding = useChatThreads((state) => isStreamingWithin(state, thread.id))

  return (
    <li
      className={cn(
        "group/thread flex h-7 items-center gap-0.5 rounded-lg pr-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      <button
        aria-current={isActive ? "true" : undefined}
        className="h-full min-w-0 flex-1 cursor-pointer truncate rounded-md pl-8 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        data-slot="chat-thread-entry"
        onClick={onOpen}
        title={thread.title}
        type="button"
      >
        {thread.title}
      </button>
      <div className="relative flex size-6 shrink-0 items-center justify-center">
        {isResponding && (
          <output
            aria-label="Responding"
            className="pointer-events-none absolute inset-0 flex items-center justify-center group-focus-within/thread:opacity-0 group-hover/thread:opacity-0 group-has-aria-expanded/thread:opacity-0"
          >
            <Loader2Icon aria-hidden="true" className="size-3.5 animate-spin text-primary" />
          </output>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={`Chat thread actions for ${thread.title}`}
                className="size-6 shrink-0 text-muted-foreground opacity-0 group-hover/thread:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                size="icon-xs"
                type="button"
                variant="ghost"
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem onClick={onDelete} variant="destructive">
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}
