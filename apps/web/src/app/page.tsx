import { Card } from "@pcc/ui";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card>
        <p className="text-slate-600 dark:text-slate-400">
          At-a-glance backend status, frontend status, and active agents. Phase 1.
        </p>
      </Card>
    </div>
  );
}
