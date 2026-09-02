import { definePlugin, defineRule } from "@oxlint/plugins"

const singleLineStatementTypes = new Set([
  "BreakStatement",
  "ContinueStatement",
  "ExpressionStatement",
  "ReturnStatement",
  "ThrowStatement",
])

const ifBraces = defineRule({
  meta: {
    type: "layout",
    docs: {
      description: "Omit braces for single-line if statements and require them otherwise.",
    },
    fixable: "code",
    messages: {
      missingBraces: "Add braces to this multiline if statement.",
      unnecessaryBraces: "Remove unnecessary braces from this single-line if statement.",
    },
  },
  create(context) {
    return {
      IfStatement(node) {
        const block = node.consequent
        const location = context.sourceCode.getLoc(node)

        if (location.start.line !== location.end.line) {
          const alternate = node.alternate

          if (block.type !== "BlockStatement") {
            context.report({
              node: block,
              messageId: "missingBraces",
              fix: (fixer) => fixer.replaceText(block, `{${context.sourceCode.getText(block)}}`),
            })
          }

          if (
            alternate &&
            alternate.type !== "BlockStatement" &&
            alternate.type !== "IfStatement"
          ) {
            context.report({
              node: alternate,
              messageId: "missingBraces",
              fix: (fixer) =>
                fixer.replaceText(alternate, `{${context.sourceCode.getText(alternate)}}`),
            })
          }
        }

        if (block.type !== "BlockStatement") return
        if (node.alternate || block.body.length !== 1) return

        const statement = block.body[0]

        if (
          !singleLineStatementTypes.has(statement.type) ||
          context.sourceCode.getCommentsInside(block).length > 0
        ) {
          return
        }

        const conditionLocation = context.sourceCode.getLoc(node.test)
        const statementLocation = context.sourceCode.getLoc(statement)

        if (
          conditionLocation.start.line !== conditionLocation.end.line ||
          statementLocation.start.line !== statementLocation.end.line
        ) {
          return
        }

        const ifLocation = context.sourceCode.getLoc(node)
        const lineLength =
          ifLocation.start.column +
          6 +
          context.sourceCode.getText(node.test).length +
          context.sourceCode.getText(statement).length

        if (lineLength > 100) return

        context.report({
          node: block,
          messageId: "unnecessaryBraces",
          fix: (fixer) => fixer.replaceText(block, context.sourceCode.getText(statement)),
        })
      },
    }
  },
})

export default definePlugin({
  meta: { name: "pdfantom" },
  rules: { "if-braces": ifBraces },
})
