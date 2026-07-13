import { createLucideIcon } from "lucide-react"

export const FitPageIcon = createLucideIcon("fit-page", [
  ["rect", { width: "14", height: "20", x: "5", y: "2", rx: "2", key: "page" }],
  ["path", { d: "m9 9 3-3 3 3", key: "up" }],
  ["path", { d: "m9 15 3 3 3-3", key: "down" }],
])
