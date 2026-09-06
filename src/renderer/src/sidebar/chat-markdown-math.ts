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

export function normalizeMathDelimiters(text: string) {
  if (!text.includes("\\[") && !text.includes("\\(")) return text

  return text
    .split(CODE_SEGMENT_PATTERN)
    .map((segment, index) => (index % 2 === 1 ? segment : rewriteDelimiters(segment)))
    .join("")
}

function rewriteDelimiters(segment: string) {
  return segment
    .replace(DISPLAY_MATH_PATTERN, (_match, math: string) => `$$${math.trim()}$$`)
    .replace(INLINE_MATH_PATTERN, (_match, math: string) => `$${math.trim()}$`)
}
