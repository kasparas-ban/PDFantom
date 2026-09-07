// Models emit maths with either the markdown-friendly `$…$` delimiters that
// `remark-math` understands or LaTeX's own `\(…\)` and `\[…\]`. Markdown treats a
// backslash before punctuation as an escape, so `\(` reaches the parser as a bare
// `(` and the TeX inside is rendered as literal text. Rewriting the delimiters on
// the source, before parsing, is the only place the backslashes still exist.

// Fenced blocks and code spans are captured so their contents pass through
// untouched; an unterminated fence still matches while a response is streaming.
const CODE_SEGMENT_PATTERN = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g
const DISPLAY_MATH_PATTERN = /\\\[([\s\S]*?)\\\]/g
const INLINE_MATH_PATTERN = /\\\(([\s\S]*?)\\\)/g

// `remark-math` reads a `$$` that opens at the start of a line and is followed by
// more text as a display fence: that first line becomes fence metadata and is
// dropped, and with no line holding a closing `$$` on its own the block swallows
// the rest of the paragraph, which KaTeX then fails to typeset. Models write such
// equations whenever they break a long `$$…$$` across lines. Joining the lines
// keeps the pair as text maths, which `remarkDisplayMath` renders in display
// mode. A genuine fence, whose opening `$$` ends its line, is left alone.
const SPLIT_DOUBLE_DOLLAR_PATTERN = /\$\$([^$\n][^$]*?)\$\$/g
const LINE_BREAK_PATTERN = /\s*\n\s*/g

export function normalizeMathDelimiters(text: string) {
  if (!text.includes("\\[") && !text.includes("\\(") && !text.includes("$$")) return text

  return text
    .split(CODE_SEGMENT_PATTERN)
    .map((segment, index) => (index % 2 === 1 ? segment : rewriteMath(segment)))
    .join("")
}

function rewriteMath(segment: string) {
  return segment
    .replace(DISPLAY_MATH_PATTERN, (_match, math: string) => `$$${joinLines(math)}$$`)
    .replace(INLINE_MATH_PATTERN, (_match, math: string) => `$${math.trim()}$`)
    .replace(SPLIT_DOUBLE_DOLLAR_PATTERN, (match, math: string) =>
      math.includes("\n") ? `$$${joinLines(math)}$$` : match,
    )
}

function joinLines(math: string) {
  return math.trim().replace(LINE_BREAK_PATTERN, " ")
}

// `remark-math` only parses display maths when the `$$` fence opens and closes on
// its own lines. `$$…$$` written on one line, whether by the model or by the
// rewrites above, parses as inline maths and the equation is typeset in the
// running text. The node does not record how many dollars opened it, but its
// source position does: promote every inline node whose source opens with `$$`
// so KaTeX renders it in display mode, centred on its own line.

const DISPLAY_MATH_CLASS_NAMES = ["language-math", "math-display"]

type MarkdownNode = {
  type: string
  children?: MarkdownNode[]
  data?: { hProperties?: Record<string, unknown> }
  position?: { start: { offset?: number } }
}

export function remarkDisplayMath() {
  return (tree: MarkdownNode, file: { value: unknown }) => {
    const source = String(file.value)

    visitInlineMath(tree, (node) => {
      const offset = node.position?.start.offset
      if (offset === undefined || !source.startsWith("$$", offset)) return

      node.data = {
        ...node.data,
        hProperties: { ...node.data?.hProperties, className: DISPLAY_MATH_CLASS_NAMES },
      }
    })
  }
}

function visitInlineMath(node: MarkdownNode, visit: (node: MarkdownNode) => void) {
  if (node.type === "inlineMath") visit(node)

  for (const child of node.children ?? []) visitInlineMath(child, visit)
}
