import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessageTiming,
} from "@assistant-ui/react"
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk"
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  MicIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  SquareIcon,
} from "lucide-react"

import { OpenAILogo } from "@/components/model-logos"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChatPanelShell } from "./chat-panel-shell"

export function ChatPanel() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: "/api/chat" }),
  })

  return (
    <ChatPanelShell>
      <div aria-hidden="true" className="window-drag-region h-12 shrink-0" />

      <AssistantRuntimeProvider runtime={runtime}>
        <ChatThread />
      </AssistantRuntimeProvider>
    </ChatPanelShell>
  )
}

function ChatThread() {
  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
      <ThreadPrimitive.Viewport className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth px-4 pt-5">
        <AuiIf condition={(state) => state.thread.isEmpty}>
          <div className="flex flex-1 items-center justify-center px-3 pb-[12vh] text-center">
            <p className="text-base font-medium text-sidebar-foreground">
              How can I help you today?
            </p>
          </div>
        </AuiIf>

        <div className="flex flex-col gap-6 pb-8 empty:hidden">
          <ThreadPrimitive.Messages
            components={{
              AssistantMessage,
              UserMessage,
            }}
          />
        </div>

        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto bg-sidebar pt-3 pb-4">
          <ChatComposer />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}

function ChatComposer() {
  return (
    <ComposerPrimitive.Root className="flex w-full flex-col gap-2 rounded-3xl border border-sidebar-border/80 bg-background/90 p-2 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.16),0_1px_2px_rgba(0,0,0,0.06)] transition-[border-color,box-shadow] focus-within:border-sidebar-ring focus-within:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.08)]">
      <ComposerPrimitive.Input asChild>
        <Textarea
          aria-label="Message"
          className="max-h-40 min-h-16 resize-none border-0 bg-transparent px-2.5 py-1.5 text-sm shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0 dark:bg-transparent"
          placeholder="Send a message… (@ to mention, / for commands)"
          rows={1}
        />
      </ComposerPrimitive.Input>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
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
          <Button
            aria-label="Choose model"
            className="h-7 min-w-0 shrink! justify-start rounded-full px-1.5 text-xs font-medium active:scale-[0.97] disabled:opacity-70"
            disabled
            size="sm"
            type="button"
            variant="ghost"
          >
            <OpenAILogo className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">GPT-5.4 Nano</span>
            <ChevronDownIcon className="size-3 text-muted-foreground" />
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
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
          <AuiIf condition={(state) => !state.thread.isRunning}>
            <ComposerPrimitive.Send asChild>
              <Button
                aria-label="Send message"
                className="size-7 rounded-full active:scale-[0.97]"
                size="icon-sm"
                type="button"
              >
                <ArrowUpIcon />
              </Button>
            </ComposerPrimitive.Send>
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
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[85%] rounded-xl bg-muted px-3.5 py-2.5 text-sm wrap-break-word text-foreground">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="group/message text-sm leading-relaxed wrap-break-word">
      <div className="py-1">
        <MessagePrimitive.Parts />
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
          <ErrorPrimitive.Root className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <ErrorPrimitive.Message />
          </ErrorPrimitive.Root>
        </MessagePrimitive.Error>
      </div>
      <AssistantActionBar />
    </MessagePrimitive.Root>
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
