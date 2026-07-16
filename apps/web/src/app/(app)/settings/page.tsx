"use client";

import { useState, type FormEvent } from "react";
import { Badge, Button, Card, Input, Label, Skeleton } from "@pcc/ui";
import type { SaveSettingInput } from "@/lib/api-client";
import { useSaveSettings, useSettings } from "@/hooks/useSettings";

const SETTING_KEYS = {
  render: "render_api_token",
  vercel: "vercel_api_token",
  screenshot: "screenshot_service_key",
} as const;

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const saveSettings = useSaveSettings();

  const [renderToken, setRenderToken] = useState("");
  const [vercelToken, setVercelToken] = useState("");
  const [screenshotKey, setScreenshotKey] = useState("");

  const findSetting = (key: string) => settings?.find((s) => s.key === key);
  const isConfigured = (key: string) => Boolean(findSetting(key)?.configured);

  const hasInput = Boolean(renderToken.trim() || vercelToken.trim() || screenshotKey.trim());

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const entries: SaveSettingInput[] = [];
    if (renderToken.trim()) entries.push({ key: SETTING_KEYS.render, value: renderToken.trim(), secret: true });
    if (vercelToken.trim()) entries.push({ key: SETTING_KEYS.vercel, value: vercelToken.trim(), secret: true });
    if (screenshotKey.trim()) entries.push({ key: SETTING_KEYS.screenshot, value: screenshotKey.trim(), secret: true });
    if (entries.length === 0) return;

    await saveSettings.mutateAsync(entries);
    setRenderToken("");
    setVercelToken("");
    setScreenshotKey("");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">API tokens</h2>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="render_token">Render API token</Label>
                <Badge variant="outline">{isConfigured(SETTING_KEYS.render) ? "Configured" : "Not set"}</Badge>
              </div>
              <Input
                id="render_token"
                type="password"
                placeholder={isConfigured(SETTING_KEYS.render) ? "•••••••• (leave blank to keep current)" : "rnd_…"}
                value={renderToken}
                onChange={(e) => setRenderToken(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="vercel_token">Vercel API token</Label>
                <Badge variant="outline">{isConfigured(SETTING_KEYS.vercel) ? "Configured" : "Not set"}</Badge>
              </div>
              <Input
                id="vercel_token"
                type="password"
                placeholder={isConfigured(SETTING_KEYS.vercel) ? "•••••••• (leave blank to keep current)" : "…"}
                value={vercelToken}
                onChange={(e) => setVercelToken(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="screenshot_key">Screenshot service key</Label>
                <Badge variant="outline">Phase 2</Badge>
                <Badge variant="outline">{isConfigured(SETTING_KEYS.screenshot) ? "Configured" : "Not set"}</Badge>
              </div>
              <Input
                id="screenshot_key"
                type="password"
                placeholder={
                  isConfigured(SETTING_KEYS.screenshot) ? "•••••••• (leave blank to keep current)" : "Not used yet — stored for later"
                }
                value={screenshotKey}
                onChange={(e) => setScreenshotKey(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={saveSettings.isPending || !hasInput}>
              {saveSettings.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Sheet-DB</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Admin sheet</span>
          <Badge variant="outline">Configured via ADMIN_SHEET_ID</Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Connection status</span>
          <Badge variant="outline">Unknown — no health check route yet</Badge>
        </div>
      </Card>
    </div>
  );
}
