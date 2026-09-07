import { useEffect, useState } from "react"
import { CircleAlertIcon, CircleCheckIcon, EyeIcon, EyeOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { CodexSettings } from "../../../shared/settings-api"
import { usePlatform } from "../app/platform"
import { useChatModelStore } from "../sidebar/chat-session"
import { SettingsCard, SettingsPageLayout, SettingsSection } from "./settings-layout"

type ApiKeyStatus = "error" | "idle" | "loading" | "saved" | "saving"

export function ProviderSettings() {
  return (
    <SettingsPageLayout title="AI Provider">
      <OpenRouterSettings />
      <CodexSessionSettings />
    </SettingsPageLayout>
  )
}

function OpenRouterSettings() {
  const platform = usePlatform()
  const [apiKeyDraft, setApiKeyDraft] = useState("")
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)
  const [mode, setMode] = useState<"edit" | "view">("view")
  const [status, setStatus] = useState<ApiKeyStatus>("loading")
  const isApiKeyRevealed = Boolean(revealedApiKey)

  useEffect(() => {
    let isCurrent = true

    void platform
      .getOpenRouterApiKeyStatus()
      .then(({ isConfigured: savedApiKeyExists }) => {
        if (!isCurrent) return
        setIsConfigured(savedApiKeyExists)
        setStatus("idle")
      })
      .catch(() => {
        if (isCurrent) setStatus("error")
      })

    return () => {
      isCurrent = false
    }
  }, [platform])

  const revealApiKey = async () => {
    if (revealedApiKey) {
      setRevealedApiKey(null)
      return
    }

    setStatus("loading")

    try {
      const savedApiKey = await platform.getOpenRouterApiKey()
      setRevealedApiKey(savedApiKey)
      setIsConfigured(Boolean(savedApiKey))
      setStatus("idle")
    } catch {
      setStatus("error")
    }
  }

  const startEditing = async () => {
    setRevealedApiKey(null)

    if (!isConfigured) {
      setApiKeyDraft("")
      setMode("edit")
      setStatus("idle")
      return
    }

    setStatus("loading")

    try {
      const savedApiKey = await platform.getOpenRouterApiKey()
      setApiKeyDraft(savedApiKey || "")
      setIsConfigured(Boolean(savedApiKey))
      setMode("edit")
      setStatus("idle")
    } catch {
      setStatus("error")
    }
  }

  const cancelEditing = () => {
    setApiKeyDraft("")
    setMode("view")
    setStatus("idle")
  }

  const saveApiKey = async () => {
    const nextApiKey = apiKeyDraft.trim()

    setStatus("saving")

    try {
      await platform.saveOpenRouterApiKey(nextApiKey)
      setApiKeyDraft("")
      setIsConfigured(Boolean(nextApiKey))
      setMode("view")
      setStatus("saved")
    } catch {
      setStatus("error")
    }
  }

  return (
    <SettingsSection title="OpenRouter">
      <SettingsCard>
        <div className="p-5">
          <label className="text-sm font-medium" htmlFor="openrouter-api-key">
            API key
          </label>
          <p
            className="mt-1 text-sm leading-5 text-muted-foreground"
            id="openrouter-api-key-description"
          >
            Enter your OpenRouter API key to use OpenRouter models in chat.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                aria-describedby="openrouter-api-key-description"
                autoComplete="off"
                className={cn(
                  "bg-background",
                  mode === "view" && "pointer-events-none select-none",
                  mode === "view" && isConfigured && "pr-10",
                )}
                disabled={status === "loading" || status === "saving"}
                id="openrouter-api-key"
                onChange={(event) => {
                  setApiKeyDraft(event.target.value)
                  if (status === "error" || status === "saved") setStatus("idle")
                }}
                placeholder={isConfigured ? "••••••••••••••••" : "No API key saved"}
                readOnly={mode === "view"}
                tabIndex={mode === "view" ? -1 : undefined}
                type={mode === "edit" || isApiKeyRevealed ? "text" : "password"}
                value={mode === "edit" ? apiKeyDraft : revealedApiKey || ""}
              />
              {mode === "view" && isConfigured && (
                <Button
                  aria-label={isApiKeyRevealed ? "Hide key" : "View key"}
                  className="absolute inset-y-0 right-0.5 my-auto text-muted-foreground active:not-aria-[haspopup]:translate-y-0"
                  disabled={status === "loading"}
                  onClick={revealApiKey}
                  size="icon-sm"
                  title={isApiKeyRevealed ? "Hide key" : "View key"}
                  type="button"
                  variant="ghost"
                >
                  {isApiKeyRevealed ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              )}
            </div>
            {mode === "edit" ? (
              <>
                <Button
                  disabled={status === "saving"}
                  onClick={cancelEditing}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  disabled={(!isConfigured && !apiKeyDraft.trim()) || status === "saving"}
                  onClick={saveApiKey}
                  type="button"
                >
                  {status === "saving" ? "Saving…" : "Save key"}
                </Button>
              </>
            ) : (
              <Button disabled={status === "loading"} onClick={startEditing} type="button">
                Edit key
              </Button>
            )}
          </div>
          {status === "loading" && (
            <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
              Checking saved key…
            </p>
          )}
          {isConfigured && status !== "error" && status !== "loading" && (
            <p
              aria-live="polite"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
              API key saved securely on this Mac
            </p>
          )}
          {status === "error" && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              The API key could not be loaded or saved. Try again.
            </p>
          )}
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}

function CodexSessionSettings() {
  const platform = usePlatform()
  const chatModelStore = useChatModelStore()
  const [settings, setSettings] = useState<CodexSettings | null>(null)
  const [pathDraft, setPathDraft] = useState("")
  const [status, setStatus] = useState<"error" | "idle" | "loading" | "saving">("loading")

  useEffect(() => {
    let isCurrent = true

    void platform
      .getCodexSettings()
      .then((loaded) => {
        if (!isCurrent) return
        setSettings(loaded)
        setPathDraft(loaded.executablePathOverride ?? "")
        setStatus("idle")
      })
      .catch(() => {
        if (isCurrent) setStatus("error")
      })

    return () => {
      isCurrent = false
    }
  }, [platform])

  const savePath = async () => {
    setStatus("saving")

    try {
      const saved = await platform.saveCodexExecutablePath(pathDraft.trim())
      setSettings(saved)
      setPathDraft(saved.executablePathOverride ?? "")
      setStatus("idle")
      void chatModelStore.getState().loadSourceListings("chatgpt")
    } catch {
      setStatus("error")
    }
  }

  const session = settings?.session
  const isBusy = status === "loading" || status === "saving"

  return (
    <SettingsSection title="ChatGPT via Codex">
      <SettingsCard>
        <div className="p-5">
          <h3 className="text-sm font-medium">Codex Session</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            ChatGPT models use the Codex CLI already installed and signed in on this Mac. PDFantom
            never sees or stores that sign-in.
          </p>
          {status === "loading" && (
            <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
              Checking Codex…
            </p>
          )}
          {session && status !== "loading" && (
            <p
              aria-live="polite"
              className="mt-3 inline-flex items-start gap-1.5 text-sm text-muted-foreground"
            >
              {session.available ? (
                <>
                  <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Codex {session.version} is signed in and ready</span>
                </>
              ) : (
                <>
                  <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{session.reason}</span>
                </>
              )}
            </p>
          )}

          <label className="mt-5 block text-sm font-medium" htmlFor="codex-executable-path">
            Codex executable
          </label>
          <p
            className="mt-1 text-sm leading-5 text-muted-foreground"
            id="codex-executable-path-description"
          >
            Leave empty to use the standard install locations
            {session?.executablePath ? ` (found ${session.executablePath})` : ""}.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Input
              aria-describedby="codex-executable-path-description"
              autoComplete="off"
              className="bg-background"
              disabled={isBusy}
              id="codex-executable-path"
              onChange={(event) => setPathDraft(event.target.value)}
              placeholder="/usr/local/bin/codex"
              value={pathDraft}
            />
            <Button
              disabled={isBusy || pathDraft.trim() === (settings?.executablePathOverride ?? "")}
              onClick={savePath}
              type="button"
            >
              {status === "saving" ? "Saving…" : "Save path"}
            </Button>
          </div>
          {status === "error" && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              The Codex settings could not be loaded or saved. Try again.
            </p>
          )}
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
