import { Card } from "@pcc/ui";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <p className="text-slate-600 dark:text-slate-400">
          Render token, Vercel token, sheet-DB config, screenshot service key.
        </p>
      </Card>
    </div>
  );
}
