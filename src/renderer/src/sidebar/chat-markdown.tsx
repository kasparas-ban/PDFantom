import { useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import Markdown, { type Components } from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { Button } from "@/components/ui/button"
import { normalizeMathDelimiters, remarkDisplayMath } from "./chat-markdown-math"

import "katex/dist/katex.min.css"

const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkDisplayMath]
const REHYPE_PLUGINS = [rehypeKatex]

type HastNode = {
  readonly type: string
  readonly value?: string
  readonly children?: readonly HastNode[]
  readonly properties?: { readonly className?: unknown }
}

export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="text-[15px] leading-relaxed wrap-break-word [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-2 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
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
  h1: ({ node: _node, children, ...props }) => (
    <h2 className="mt-7 mb-3 text-xl/7 font-semibold" {...props}>
      {children}
    </h2>
  ),
  h2: ({ node: _node, children, ...props }) => (
    <h3 className="mt-6 mb-2.5 text-lg/7 font-semibold" {...props}>
      {children}
    </h3>
  ),
  h3: ({ node: _node, children, ...props }) => (
    <h4 className="mt-5 mb-2 text-[15px]/6 font-semibold" {...props}>
      {children}
    </h4>
  ),
  h4: ({ node: _node, children, ...props }) => (
    <h5 className="mt-5 mb-2 text-[15px]/6 font-semibold" {...props}>
      {children}
    </h5>
  ),
  h5: ({ node: _node, children, ...props }) => (
    <h6 className="mt-5 mb-2 text-[15px]/6 font-semibold text-muted-foreground" {...props}>
      {children}
    </h6>
  ),
  h6: ({ node: _node, children, ...props }) => (
    <h6 className="mt-5 mb-2 text-[15px]/6 font-semibold text-muted-foreground" {...props}>
      {children}
    </h6>
  ),

  p: ({ node: _node, ...props }) => <p className="my-3" {...props} />,
  strong: ({ node: _node, ...props }) => <strong className="font-semibold" {...props} />,
  em: ({ node: _node, ...props }) => <em className="italic" {...props} />,
  del: ({ node: _node, ...props }) => (
    <del className="text-muted-foreground line-through" {...props} />
  ),
  hr: ({ node: _node, ...props }) => <hr className="my-4 border-sidebar-border" {...props} />,

  a: ({ node: _node, children, ...props }) => (
    <a
      className="font-medium underline decoration-muted-foreground underline-offset-2 hover:decoration-current"
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  ),

  ul: ({ node: _node, ...props }) => (
    <ul
      className="my-3 list-disc space-y-1.5 pl-5 marker:text-muted-foreground [&_ol]:my-2 [&_ul]:my-2"
      {...props}
    />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol
      className="my-3 list-decimal space-y-1.5 pl-5 marker:text-muted-foreground [&_ol]:my-2 [&_ul]:my-2"
      {...props}
    />
  ),
  li: ({ node: _node, ...props }) => <li className="[&>p]:my-0 [&>p+p]:mt-2" {...props} />,

  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="my-4 border-l-2 border-muted-foreground/30 pl-4 text-muted-foreground"
      {...props}
    />
  ),

  table: ({ node: _node, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-sidebar-border">
      <table className="w-full border-collapse text-left text-[13px]/5" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => <thead className="bg-sidebar-accent/60" {...props} />,
  tr: ({ node: _node, ...props }) => (
    <tr className="border-b border-sidebar-border last:border-b-0" {...props} />
  ),
  th: ({ node: _node, ...props }) => <th className="px-3 py-2 font-semibold" {...props} />,
  td: ({ node: _node, ...props }) => <td className="px-3 py-2 align-top" {...props} />,

  code: ({ node: _node, className: _className, ...props }) => (
    <code
      className="rounded-sm bg-sidebar-accent px-1 py-0.5 font-mono text-[0.875em] wrap-anywhere"
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
    <div className="my-4 overflow-hidden rounded-lg border border-sidebar-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border bg-sidebar-accent/50 py-0.5 pr-0.5 pl-2.5">
        <span className="truncate font-mono text-xs text-muted-foreground">
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
      <pre className="overflow-x-auto px-3 py-2.5">
        <code className="font-mono text-[13px] leading-5">{code}</code>
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
