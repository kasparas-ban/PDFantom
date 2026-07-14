import type { ComponentProps } from "react"

export function PdfantomLogo(props: ComponentProps<"svg">) {
  return (
    <svg
      fill="none"
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M331 154h362c101 0 161 62 161 162v376c0 101-60 163-161 163H331c-101 0-161-62-161-163V316c0-100 60-162 161-162Z"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M350 265h226l133 133v258c0 23 3 45 10 65 2 7-3 12-10 11-64-4-103-33-112-82-9-68-37-117-86-117s-77 49-86 117c-9 49-48 78-112 82-7 1-12-4-10-11 12-27 18-48 18-65V294c0-16 13-29 29-29Z"
        fill="currentColor"
      />
      <path d="M576 265 709 398H608c-18 0-32-14-32-32V265Z" fill="currentColor" opacity="0.55" />
      <rect x="475" y="588" width="25" height="50" rx="12.5" fill="currentColor" />
      <rect x="523" y="588" width="25" height="50" rx="12.5" fill="currentColor" />
    </svg>
  )
}
