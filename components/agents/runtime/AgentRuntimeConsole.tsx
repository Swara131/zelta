"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send } from "lucide-react";
import AgentResultRenderer from "@/components/agents/results/AgentResultRenderer";
import type { RunAgentResult } from "@/lib/agents/runtime/types";
import { pollLatestRunSteps, type LiveRunStep } from "./AgentLiveRunPanel";

interface ChatTurn {
  id: string;
  role: "user" | "agent";
  content: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function speechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const Speech = (
    window as Window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    }
  ).SpeechRecognition;
  const WebkitSpeech = (
    window as Window & {
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    }
  ).webkitSpeechRecognition;
  return Speech ?? WebkitSpeech ?? null;
}

export default function AgentRuntimeConsole({
  agentSlug,
  disabledReason,
  onSteps,
}: {
  agentSlug: string | null;
  disabledReason?: string | null;
  onSteps?: (steps: LiveRunStep[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceHint, setVoiceHint] = useState("Voice uses the same agent as chat and test.");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    setVoiceReady(Boolean(speechRecognitionCtor()));
  }, []);

  const runTask = async (text: string) => {
    if (!agentSlug || sending || text.trim().length < 3) return;
    setSending(true);
    setError(null);
    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    setTurns((current) => [...current, userTurn]);
    setDraft("");

    const poll = window.setInterval(() => {
      void pollLatestRunSteps(agentSlug).then((steps) => onSteps?.(steps));
    }, 900);

    try {
      const response = await fetch(`/api/v1/agents/${encodeURIComponent(agentSlug)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: text.trim(), mode: "manual" }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        needsInput?: boolean;
        result?: RunAgentResult;
        error?: string;
        preparePath?: string;
      };
      if (payload.needsInput && payload.result?.summary) {
        setTurns((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "agent",
            content: payload.result!.summary as string,
          },
        ]);
        return;
      }
      if (response.status === 409) {
        setError(payload.error ?? "This agent still needs setup.");
        setTurns((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "agent",
            content: payload.error ?? "I need a few details first. Open Prepare your agent.",
          },
        ]);
        return;
      }
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "The agent could not run.");
      }
      onSteps?.(payload.result.steps ?? []);
      const content =
        payload.result.summary ??
        payload.result.error ??
        "The agent finished without a written result.";
      setTurns((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "agent", content },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The agent could not run.");
    } finally {
      window.clearInterval(poll);
      setSending(false);
    }
  };

  const startVoice = () => {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setVoiceHint("Voice isn't available in this browser. Use chat instead.");
      return;
    }
    try {
      const recognition = new Ctor();
      recognition.lang = "en-IN";
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) void runTask(transcript);
      };
      recognition.onerror = () => {
        setListening(false);
        setVoiceHint("Microphone permission is required to talk to this agent.");
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      setVoiceHint("Voice isn't configured on this device.");
    }
  };

  return (
    <section className="arc-console" aria-label="Ask your agent">
      <h2>Ask your agent</h2>
      <p>Chat uses the same live agent, workflow, and tools as Test.</p>
      {disabledReason ? <p className="arc-hint">{disabledReason}</p> : null}
      <div className="arc-thread">
        {turns.map((turn) => (
          <article key={turn.id} className={`arc-bubble is-${turn.role}`}>
            {turn.role === "agent" ? (
              <AgentResultRenderer result={turn.content} status="completed" />
            ) : (
              <p>{turn.content}</p>
            )}
          </article>
        ))}
      </div>
      <form
        className="arc-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void runTask(draft);
        }}
      >
        <input
          className="ds-input"
          value={draft}
          disabled={!agentSlug || sending}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask this agent something…"
        />
        <button type="submit" className="wfb-btn wfb-btn-primary" disabled={!agentSlug || sending || draft.trim().length < 3}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </button>
      </form>
      {error ? <p className="att-error">{error}</p> : null}

      <div className="arc-voice">
        <h3>Voice</h3>
        {voiceReady ? (
          <button
            type="button"
            className="wfb-btn wfb-btn-secondary"
            disabled={!agentSlug || sending}
            onClick={() => (listening ? recognitionRef.current?.stop() : startVoice())}
          >
            <Mic className="h-4 w-4" />
            {listening ? "Listening…" : "Talk to your agent"}
          </button>
        ) : (
          <p className="arc-hint">Voice isn&apos;t available here. Chat uses the same agent.</p>
        )}
        <p className="arc-hint">{voiceHint}</p>
      </div>
    </section>
  );
}
