"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Mic, MicOff, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
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
import type { Agent } from "@pcc/types";
import { useAgents } from "@/hooks/useAgents";
import { useCommandPoll } from "@/hooks/useCommandPoll";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { api } from "@/lib/api-client";

const QUICK_COMMANDS = ["Give me a status report", "What's blocking you?", "Assign a new task"];

/**
 * Minimal, scoped spacing reset for markdown rendered inside a chat bubble — this repo has no
 * `@tailwindcss/typography` plugin (Tailwind v3, deliberately not pulled in for this one use
 * case), and Tailwind's preflight zeroes out `p`/`ul`/`ol` margins by default, so without this the
 * block-level elements `ReactMarkdown` renders (lists, code blocks, paragraphs) would all
 * collapse onto each other. `space-y-2` handles spacing between top-level blocks; the `[&_x]`
 * descendant selectors handle the handful of inline/nested elements likely to show up in an
 * agent's reply.
 */
const AGENT_MARKDOWN_CLASS =
  "space-y-2 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal [&_li]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:text-xs [&_code]:font-mono [&_code]:text-xs [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-current/30 [&_blockquote]:pl-2 [&_blockquote]:italic";

interface LogEntry {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  at: string;
}

/**
 * Applies the agent's configured `voice_uri` (if any) to the utterance. `voice_uri` is stored per
 * agent, but the actual `SpeechSynthesisVoice` objects only exist in the current browser's
 * runtime voice list — if the agent was configured on a different machine/browser where that
 * voiceURI doesn't exist, this falls back silently to the browser default rather than erroring.
 */
function speak(text: string, agent?: Agent) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  if (agent?.voice_uri) {
    const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === agent.voice_uri);
    if (voice) {
      utterance.voice = voice;
    }
  }
  window.speechSynthesis.speak(utterance);
}

function VoiceConsole() {
  const searchParams = useSearchParams();
  const { data: agents, isLoading } = useAgents();
  const [agentId, setAgentId] = useState(searchParams.get("agent") ?? "");
  const [inputText, setInputText] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [sending, setSending] = useState(false);

  const { supported, listening, start, stop } = useSpeechRecognition((text) => {
    setInputText(text);
  });
  const { poll, cancel } = useCommandPoll();
  const selectedAgent = agents?.find((a) => a._id === agentId);

  // If the user switches agents mid-poll (or navigates away), don't let a stale reply land in
  // what's now a different agent's transcript.
  useEffect(() => {
    return () => cancel();
  }, [agentId, cancel]);

  async function sendMessage(text: string) {
    if (!agentId || !text.trim()) return;
    const userEntry: LogEntry = { id: crypto.randomUUID(), role: "user", text, at: new Date().toISOString() };
    setLog((prev) => [...prev, userEntry]);
    setInputText("");
    setSending(true);
    try {
      const { command_id } = await api.agents.sendMessage(agentId, text);
      const outcome = await poll(command_id);
      if (outcome.kind === "done") {
        const replyText = outcome.command.result ?? "";
        setLog((prev) => [...prev, { id: crypto.randomUUID(), role: "agent", text: replyText, at: new Date().toISOString() }]);
        speak(replyText, selectedAgent);
      } else if (outcome.kind === "failed") {
        const failureText = outcome.command.result ?? "The agent failed to complete this command.";
        setLog((prev) => [...prev, { id: crypto.randomUUID(), role: "system", text: failureText, at: new Date().toISOString() }]);
      } else if (outcome.kind === "timeout") {
        setLog((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            text: "Still running — this is taking longer than expected. It may still finish in the background; check back later.",
            at: new Date().toISOString(),
          },
        ]);
      } else {
        setLog((prev) => [...prev, { id: crypto.randomUUID(), role: "system", text: outcome.message, at: new Date().toISOString() }]);
      }
    } catch (error) {
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
                {entry.role === "agent" ? (
                  <div className={AGENT_MARKDOWN_CLASS}>
                    <ReactMarkdown>{entry.text}</ReactMarkdown>
                  </div>
                ) : (
                  entry.text
                )}
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
