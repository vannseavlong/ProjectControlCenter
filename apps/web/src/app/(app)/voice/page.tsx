"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Mic, MicOff, Send } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pcc/ui";
import { useAgents } from "@/hooks/useAgents";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { api } from "@/lib/api-client";

const QUICK_COMMANDS = ["Give me a status report", "What's blocking you?", "Assign a new task"];

interface LogEntry {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  at: string;
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function VoiceConsole() {
  const searchParams = useSearchParams();
  const { data: agents, isLoading } = useAgents();
  const [agentId, setAgentId] = useState(searchParams.get("agent") ?? "");
  const [inputText, setInputText] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [wireError, setWireError] = useState(false);

  const { supported, listening, start, stop } = useSpeechRecognition((text) => {
    setInputText(text);
  });

  async function sendMessage(text: string) {
    if (!agentId || !text.trim()) return;
    const userEntry: LogEntry = { id: crypto.randomUUID(), role: "user", text, at: new Date().toISOString() };
    setLog((prev) => [...prev, userEntry]);
    setInputText("");
    setSending(true);
    try {
      const { reply } = await api.agents.sendMessage(agentId, text);
      setLog((prev) => [...prev, { id: crypto.randomUUID(), role: "agent", text: reply, at: new Date().toISOString() }]);
      speak(reply);
    } catch (error) {
      setWireError(true);
      const message = error instanceof Error ? error.message : "Failed to reach the agent";
      setLog((prev) => [...prev, { id: crypto.randomUUID(), role: "system", text: message, at: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(inputText);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Voice Console</h1>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Agent</span>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={isLoading ? "Loading…" : "Select an agent"} />
            </SelectTrigger>
            <SelectContent>
              {(agents ?? []).map((agent) => (
                <SelectItem key={agent._id} value={agent._id}>
                  {agent.agent_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!supported ? <Badge variant="outline">Mic not supported in this browser</Badge> : null}
      </Card>

      {wireError ? (
        <Card className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="size-4 shrink-0 text-status-sleeping" />
          Talking to agents isn’t wired up yet — agent-bridge hasn’t landed, so replies won’t come back. The
          transcript and canned commands below still work.
        </Card>
      ) : null}

      <Card className="flex min-h-80 flex-col gap-2">
        {log.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="No conversation yet"
            description="Pick an agent, then talk or type to start a transcript."
          />
        ) : (
          <ul className="flex-1 space-y-2 overflow-y-auto">
            {log.map((entry) => (
              <li
                key={entry.id}
                className={
                  entry.role === "user"
                    ? "ml-auto max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : entry.role === "agent"
                      ? "mr-auto max-w-[80%] rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground"
                      : "mx-auto max-w-[90%] rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground"
                }
              >
                {entry.text}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {QUICK_COMMANDS.map((command) => (
            <Button key={command} variant="secondary" className="h-8 text-xs" disabled={!agentId} onClick={() => void sendMessage(command)}>
              {command}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Button
            type="button"
            variant={listening ? "destructive" : "secondary"}
            className="size-9 shrink-0 px-0"
            disabled={!supported}
            onClick={() => (listening ? stop() : start())}
            aria-label={listening ? "Stop listening" : "Start listening"}
          >
            {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </Button>
          <Input
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder={agentId ? "Type or speak a message…" : "Select an agent first"}
            disabled={!agentId}
          />
          <Button type="submit" className="shrink-0" disabled={!agentId || !inputText.trim() || sending}>
            <Send className="size-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function VoiceConsolePage() {
  return (
    <Suspense fallback={null}>
      <VoiceConsole />
    </Suspense>
  );
}
