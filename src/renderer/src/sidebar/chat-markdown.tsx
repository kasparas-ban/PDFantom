import { useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import Markdown, { type Components } from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { Button } from "@/components/ui/button"
import { normalizeMathDelimiters } from "./chat-markdown-math"

import "katex/dist/katex.min.css"

const REMARK_PLUGINS = [remarkGfm, remarkMath]
const REHYPE_PLUGINS = [rehypeKatex]

type HastNode = {
  readonly type: string
  readonly value?: string
  readonly children?: readonly HastNode[]
  readonly properties?: { readonly className?: unknown }
}

export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed wrap-break-word [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
      <Markdown
        components={MARKDOWN_COMPONENTS}
        rehypePlugins={REHYPE_PLUGINS}
        remarkPlugins={REMARK_PLUGINS}
      >
        {normalizeMathDelimiters(text)}
      </Markdown>
    </div>
  )
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node, ...props }) => <h2 className="mt-5 mb-2 text-base font-semibold" {...props} />,
  h2: ({ node, ...props }) => (
    <h3 className="mt-5 mb-2 text-[0.9375rem] font-semibold" {...props} />
  ),
  h3: ({ node, ...props }) => <h4 className="mt-4 mb-1.5 text-sm font-semibold" {...props} />,
  h4: ({ node, ...props }) => <h5 className="mt-4 mb-1.5 text-sm font-semibold" {...props} />,
  h5: ({ node, ...props }) => (
    <h6 className="mt-4 mb-1.5 text-sm font-semibold text-muted-foreground" {...props} />
  ),
  h6: ({ node, ...props }) => (
    <h6 className="mt-4 mb-1.5 text-sm font-semibold text-muted-foreground" {...props} />
  ),

  p: ({ node, ...props }) => <p className="my-2" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  del: ({ node, ...props }) => <del className="text-muted-foreground line-through" {...props} />,
  hr: ({ node, ...props }) => <hr className="my-4 border-sidebar-border" {...props} />,

  a: ({ node, ...props }) => (
    <a
      className="font-medium underline decoration-muted-foreground underline-offset-2 hover:decoration-current"
      rel="noreferrer"
      target="_blank"
      {...props}
    />
  ),

  ul: ({ node, ...props }) => (
    <ul
      className="my-2 list-disc space-y-1 pl-5 marker:text-muted-foreground [&_ol]:my-1 [&_ul]:my-1"
      {...props}
    />
  ),
  ol: ({ node, ...props }) => (
    <ol
      className="my-2 list-decimal space-y-1 pl-5 marker:text-muted-foreground [&_ol]:my-1 [&_ul]:my-1"
      {...props}
    />
  ),
  li: ({ node, ...props }) => <li className="[&>p]:my-0" {...props} />,

  blockquote: ({ node, ...props }) => (
    <blockquote
      className="my-3 border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground"
      {...props}
    />
  ),

  table: ({ node, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-sidebar-border">
      <table className="w-full border-collapse text-left text-xs" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead className="bg-sidebar-accent/60" {...props} />,
  tr: ({ node, ...props }) => (
    <tr className="border-b border-sidebar-border last:border-b-0" {...props} />
  ),
  th: ({ node, ...props }) => <th className="px-2.5 py-1.5 font-semibold" {...props} />,
  td: ({ node, ...props }) => <td className="px-2.5 py-1.5 align-top" {...props} />,

  code: ({ node, className, ...props }) => (
    <code
      className="rounded-sm bg-sidebar-accent px-1 py-0.5 font-mono text-[0.85em] wrap-anywhere"
      {...props}
    />
  ),
  pre: ({ node }) => {
    const codeNode = node?.children.find((child) => child.type === "element") as
      | HastNode
      | undefined

    return <CodeBlock code={readText(codeNode)} language={readLanguage(codeNode)} />
  },
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [isCopied, setIsCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(code)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-sidebar-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border bg-sidebar-accent/50 py-0.5 pr-0.5 pl-2.5">
        <span className="truncate font-mono text-[0.6875rem] text-muted-foreground">
          {language ?? "code"}
        </span>
        <Button
          aria-label="Copy code"
          className="size-6 rounded-md text-muted-foreground active:scale-[0.97]"
          onClick={() => void copy()}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {isCopied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
      <pre className="overflow-x-auto px-2.5 py-2">
        <code className="font-mono text-xs leading-relaxed">{code}</code>
      </pre>
    </div>
  )
}

function readLanguage(node: HastNode | undefined) {
  const className = node?.properties?.className
  const classes = Array.isArray(className) ? className : [className]

  return classes
    .filter((entry): entry is string => typeof entry === "string")
    .find((entry) => entry.startsWith("language-"))
    ?.slice("language-".length)
}

function readText(node: HastNode | undefined): string {
  if (!node) return ""
  if (typeof node.value === "string") return node.value

  return (node.children ?? []).map(readText).join("")
}
