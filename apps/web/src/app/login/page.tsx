"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Rocket } from "lucide-react";
import { Button, Card, Input, Label } from "@pcc/ui";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_state: "Google sign-in failed a security check — try again.",
  not_allowed: "That Google account isn't authorized for this portal.",
  oauth_failed: "Google sign-in failed — try again.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    ERROR_MESSAGES[searchParams.get("error") ?? ""] ?? null,
  );
  const [submitting, setSubmitting] = useState(false);

  const next = searchParams.get("next") ?? "/";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Invalid email or password");
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="starfield-backdrop flex min-h-screen items-center justify-center px-4 text-foreground">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <Rocket className="size-5 text-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-wide">Project Control Center</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => {
            window.location.href = "/api/auth/google";
          }}
        >
          Continue with Google
        </Button>
      </Card>
    </div>
  );
}
