"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge, Button, Card, Input, Label } from "@pcc/ui";

export default function SettingsPage() {
  const [renderToken, setRenderToken] = useState("");
  const [vercelToken, setVercelToken] = useState("");
  const [screenshotKey, setScreenshotKey] = useState("");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="size-4 shrink-0 text-status-sleeping" />
        Not wired up yet — there’s no <code className="font-mono text-xs">/api/settings</code> route or
        settings table on the backend, so nothing below actually saves. This form is ready to wire up once
        that lands (see <code className="font-mono text-xs">Tasks/agent-chat.md</code>).
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">API tokens</h2>
        <div className="space-y-1.5">
          <Label htmlFor="render_token">Render API token</Label>
          <Input
            id="render_token"
            type="password"
            placeholder="rnd_…"
            value={renderToken}
            onChange={(e) => setRenderToken(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vercel_token">Vercel API token</Label>
          <Input
            id="vercel_token"
            type="password"
            placeholder="…"
            value={vercelToken}
            onChange={(e) => setVercelToken(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="screenshot_key">
            Screenshot service key <Badge variant="outline">Phase 2</Badge>
          </Label>
          <Input
            id="screenshot_key"
            type="password"
            placeholder="Not used yet"
            disabled
            value={screenshotKey}
            onChange={(e) => setScreenshotKey(e.target.value)}
          />
        </div>
        <Button disabled title="Wire up /api/settings first">
          Save
        </Button>
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
