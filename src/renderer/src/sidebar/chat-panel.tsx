import { createContext, useContext, useEffect, useState } from "react"
import {
  ActionBarPrimitive,
  AuiConfig,
  AuiIf,
  AuiProvider,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  QueueItemPrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
  useMessageTiming,
  type AssistantClient,
  type TextMessagePartProps,
} from "@assistant-ui/react"
import {
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  CornerDownRightIcon,
  CornerUpRightIcon,
  KeyRoundIcon,
  MicIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react"
import { Link } from "react-router"

import { ChatEffortSelector } from "@/components/chat-effort-selector"
import { ChatModelSelector } from "@/components/chat-model-selector"
import { PdfantomLogo } from "@/components/pdfantom-logo"
import { Button, buttonVariants } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GENERIC_CHAT_ERROR } from "../../../shared/chat-api"
import { usePlatform } from "../app/platform"
import { ChatMarkdown } from "./chat-markdown"
import { ChatPanelShell } from "./chat-panel-shell"
import { useChatModel, useChatSession } from "./chat-session"

const ApiKeyMissingContext = createContext(false)

function useIsProviderMissing() {
  const isApiKeyMissing = useContext(ApiKeyMissingContext)
  const { selectedModel } = useChatModel()

  return isApiKeyMissing && selectedModel.source === "openrouter"
}

export function ChatPanel({ client }: { client: AssistantClient }) {
  const config = AuiConfig({})

  return (
    <AuiProvider extends={client} config={config}>
      <ChatPresentation />
    </AuiProvider>
  )
}

function ChatPresentation() {
  const platform = usePlatform()
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false)

  useEffect(() => {
    let active = true

    void platform
      .getOpenRouterApiKeyStatus()
      .then(({ isConfigured }) => {
        if (active) setIsApiKeyMissing(!isConfigured)
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [platform])

  return (
    <ChatPanelShell>
      <div aria-hidden="true" className="window-drag-region h-12 shrink-0" />

      <ApiKeyMissingContext value={isApiKeyMissing}>
        <ChatThread />
      </ApiKeyMissingContext>
    </ChatPanelShell>
  )
}

function ChatThread() {
  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
      <ThreadPrimitive.Viewport className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth px-4 pt-5">
        <AuiIf condition={(state) => state.thread.isEmpty}>
          <ChatEmptyState />
        </AuiIf>

        <div className="mx-auto flex w-full max-w-182.5 flex-col gap-4 pb-8 empty:hidden">
          <ThreadPrimitive.Messages
            components={{
              AssistantMessage,
              UserMessage,
            }}
          />
        </div>

        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto rounded-t-xl bg-sidebar pb-4">
          <div className="mx-auto w-full max-w-182.5">
            <ChatComposer />
          </div>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}

function ChatEmptyState() {
  const isProviderMissing = useIsProviderMissing()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 text-center">
      <PdfantomLogo aria-hidden="true" className="size-24 opacity-70" />
      {isProviderMissing ? (
        <div className="flex max-w-56 flex-col items-center gap-2">
          <p className="text-sm font-medium text-foreground">Connect an AI provider</p>
          <Link
            to="/settings/provider"
            className={buttonVariants({
              className: "mt-1 cursor-pointer",
              variant: "outline",
              size: "sm",
            })}
          >
            <KeyRoundIcon />
            Choose provider
          </Link>
        </div>
      ) : (
        <p className="text-base font-medium text-gray-600">
          What would you like to know about this document?
        </p>
      )}
    </div>
  )
}

function ChatComposer() {
  const aui = useAui()
  const canSend = useAuiState((state) => state.composer.canSend)
  const isRunning = useAuiState((state) => state.thread.isRunning)
  const send = () => aui.composer.send({ steer: false })

  return (
    <div className="flex w-full flex-col">
      <ChatQueue />
      <ComposerPrimitive.Root
        className="relative flex w-full flex-col gap-2 rounded-xl border border-sidebar-border/80 bg-background/90 p-2 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.16),0_1px_2px_rgba(0,0,0,0.06)] transition-[border-color,box-shadow] focus-within:border-sidebar-ring focus-within:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.08)]"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSend) send()
        }}
      >
      <ComposerPrimitive.Input asChild>
        <Textarea
          aria-label="Message"
          className="max-h-40 min-h-16 resize-none border-0 bg-transparent px-2.5 py-1.5 text-sm shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0 dark:bg-transparent"
          placeholder="Send a message… (@ to mention, / for commands)"
          rows={1}
        />
      </ComposerPrimitive.Input>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0.5">
          <Button
            aria-label="Add attachment"
            className="size-7 rounded-full text-muted-foreground active:scale-[0.97]"
            disabled
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <PlusIcon />
          </Button>
          <ChatModelSelector />
          <ChatEffortSelector />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            aria-label="Voice input"
            className="size-7 rounded-full text-muted-foreground active:scale-[0.97]"
            disabled
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MicIcon />
          </Button>
          <AuiIf condition={(state) => !state.thread.isRunning || !state.composer.isEmpty}>
            <Button
              aria-label={isRunning ? "Queue message" : "Send message"}
              className="size-7 rounded-full active:scale-[0.97]"
              disabled={!canSend}
              onClick={send}
              size="icon-sm"
              type="button"
              variant={isRunning ? "outline" : "default"}
            >
              <ArrowUpIcon />
            </Button>
          </AuiIf>
          <AuiIf condition={(state) => state.thread.isRunning}>
            <ComposerPrimitive.Cancel asChild>
              <Button
                aria-label="Stop response"
                className="size-7 rounded-full active:scale-[0.97]"
                size="icon-sm"
                type="button"
              >
                <SquareIcon className="size-3 fill-current" />
              </Button>
            </ComposerPrimitive.Cancel>
          </AuiIf>
        </div>
      </div>
      </ComposerPrimitive.Root>
    </div>
  )
}

function ChatQueue() {
  return (
    <AuiIf condition={(state) => state.composer.queue.length > 0}>
      <ul
        aria-label="Queued messages"
        className="mx-2.5 -mb-2.5 flex flex-col rounded-t-xl border border-b-0 border-sidebar-border/60 bg-sidebar-accent/70 px-1.5 pt-1 pb-3.5"
      >
        <ComposerPrimitive.Queue>{() => <QueuedMessage />}</ComposerPrimitive.Queue>
      </ul>
    </AuiIf>
  )
}

function QueuedMessage() {
  const aui = useAui()
  const session = useChatSession()

  return (
    <li className="flex h-8 items-center gap-2 pl-1.5 text-sm">
      <CornerDownRightIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      <QueueItemPrimitive.Text
        className="min-w-0 flex-1 truncate text-foreground"
        data-slot="queued-message-text"
      />
      <Button
        className="h-6 gap-1 px-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => {
          aui.queueItem.move({ lane: "steer", insertAfter: null })
          session?.interruptRun()
        }}
        size="xs"
        type="button"
        variant="ghost"
      >
        <CornerUpRightIcon />
        Interrupt
      </Button>
      <QueueItemPrimitive.Remove asChild>
        <Button
          aria-label="Remove queued message"
          className="text-muted-foreground hover:text-foreground"
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Trash2Icon />
        </Button>
      </QueueItemPrimitive.Remove>
    </li>
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[85%] rounded-xl bg-sidebar-accent px-3.5 py-2.5 text-sm wrap-break-word text-foreground">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="group/message text-sm leading-relaxed wrap-break-word">
      <div className="py-1">
        <MessagePrimitive.Parts components={{ Text: AssistantMarkdown }} />
        <AuiIf
          condition={(state) =>
            state.message.status?.type === "running" && state.message.parts.length === 0
          }
        >
          <span aria-label="Assistant is working" className="animate-pulse text-muted-foreground">
            Thinking…
          </span>
        </AuiIf>
        <MessagePrimitive.Error>
          <ChatError />
        </MessagePrimitive.Error>
      </div>
      <AssistantActionBar />
    </MessagePrimitive.Root>
  )
}

function AssistantMarkdown({ text }: TextMessagePartProps) {
  return <ChatMarkdown text={text} />
}

function ChatError() {
  const error = useAuiState((state) => {
    const status = state.message.status
    const messageError = status?.type === "incomplete" ? status.error : undefined

    if (typeof messageError === "object" && messageError !== null && "message" in messageError) {
      return messageError.message
    }

    return messageError
  })
  const isProviderMissing = useIsProviderMissing()

  return (
    <ErrorPrimitive.Root className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {isProviderMissing ? (
        <>
          <span>Connect an AI provider</span>
          <Link
            to="/settings/provider"
            className={buttonVariants({
              className:
                "h-auto cursor-pointer py-0 pr-0 pl-1 text-xs text-destructive underline-offset-2 hover:text-destructive/80",
              variant: "link",
            })}
          >
            Choose provider
          </Link>
        </>
      ) : (
        <ErrorPrimitive.Message>
          {typeof error === "string" && error.trim() ? error : GENERIC_CHAT_ERROR}
        </ErrorPrimitive.Message>
      )}
    </ErrorPrimitive.Root>
  )
}

function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      className="mt-1 flex h-7 items-center gap-0.5 text-muted-foreground"
    >
      <ActionBarPrimitive.Copy asChild>
        <Button
          aria-label="Copy response"
          className="size-7 rounded-full active:scale-[0.97]"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <AuiIf condition={(state) => state.message.isCopied}>
            <CheckIcon />
          </AuiIf>
          <AuiIf condition={(state) => !state.message.isCopied}>
            <CopyIcon />
          </AuiIf>
        </Button>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <Button
          aria-label="Regenerate response"
          className="size-7 rounded-full active:scale-[0.97]"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <RefreshCwIcon />
        </Button>
      </ActionBarPrimitive.Reload>
      <Button
        aria-label="More response actions"
        className="size-7 rounded-full active:scale-[0.97]"
        disabled
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <MoreHorizontalIcon />
      </Button>
      <MessageTiming />
    </ActionBarPrimitive.Root>
  )
}

function MessageTiming() {
  const timing = useMessageTiming()
  if (timing?.totalStreamTime === undefined) return null

  return (
    <span className="px-1 text-xs text-muted-foreground tabular-nums">
      {Math.round(timing.totalStreamTime)}ms
    </span>
  )
}
