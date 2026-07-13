import { createLucideIcon } from "lucide-react"

export const DoublePageIcon = createLucideIcon("double-page", [
  ["rect", { width: "20", height: "18", x: "2", y: "3", rx: "2", key: "spread" }],
  ["path", { d: "M12 3v18", key: "fold" }],
])

export const SinglePageIcon = createLucideIcon("single-page", [
  ["rect", { width: "14", height: "18", x: "5", y: "3", rx: "2", key: "page" }],
])
