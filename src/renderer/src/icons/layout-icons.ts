import { createLucideIcon } from "lucide-react"

export const LayoutVerticalIcon = createLucideIcon("layout-vertical", [
  ["path", { d: "M3 2v6a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V2", key: "top-page" }],
  ["path", { d: "M8 2h8", key: "top-line-1" }],
  ["path", { d: "M8 6h5", key: "top-line-2" }],
  ["path", { d: "M3 22v-6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6", key: "bottom-page" }],
  ["path", { d: "M8 18h8", key: "bottom-line-1" }],
  ["path", { d: "M8 22h8", key: "bottom-line-2" }],
])

export const LayoutHorizontalIcon = createLucideIcon("layout-horizontal", [
  ["path", { d: "M2 3h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H2", key: "left-page" }],
  ["path", { d: "M2 7h5", key: "left-line-1" }],
  ["path", { d: "M2 12h5", key: "left-line-2" }],
  ["path", { d: "M2 17h5", key: "left-line-3" }],
  ["path", { d: "M22 3h-5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h5", key: "right-page" }],
  ["path", { d: "M17 7h5", key: "right-line-1" }],
  ["path", { d: "M17 12h5", key: "right-line-2" }],
  ["path", { d: "M17 17h5", key: "right-line-3" }],
])
