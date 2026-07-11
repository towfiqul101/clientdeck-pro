"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/helpers";
import { MessageSquare, RefreshCw, Send, Loader2 } from "lucide-react";

const MAX_LENGTH = 1600;

interface ThreadMessage {
  id: string;
  body?: string;
  subject?: string;
  dateAdded?: string;
  origin: "staff" | "client";
}

export function PortalMessagesPanel({
  hasPhone,
  hasEmail,
  linked,
}: {
  hasPhone: boolean;
  hasEmail: boolean;
  linked: boolean;
}) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<"SMS" | "Email">(hasPhone ? "SMS" : "Email");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/portal/messages");
      const data = await res.json();
      if (!data.ok) {
        setLoadError(data.error ?? "Could not load messages.");
        setMessages([]);
      } else {
        setMessages(data.messages ?? []);
      }
    } catch {
      setLoadError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (channel === "Email" && !subject.trim()) {
      toast("Subject is required for email.", "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: channel, message: trimmed, subject: subject.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast(data.error ?? "Send failed.", "error");
      } else {
        setText("");
        setSubject("");
        toast("Sent!", "success");
        await load();
      }
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setSending(false);
    }
  }

  if (!linked) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Messages</h1>
        <p className="rounded-xl border border-white/10 bg-[#1a1a2e] px-4 py-6 text-center text-sm text-slate-500">
          Messaging isn&apos;t available for your account yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-100">Messages</h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 text-xs font-medium text-slate-300 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      <div className="flex gap-1.5 rounded-xl border border-white/10 bg-[#1a1a2e] p-1">
        {(["SMS", "Email"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            disabled={c === "SMS" ? !hasPhone : !hasEmail}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={
              channel === c
                ? { backgroundColor: "var(--brand)", color: "white" }
                : { color: "#94a3b8" }
            }
          >
            {c === "SMS" ? "📱 SMS" : "📧 Email"}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a2e] p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : loadError ? (
          <p className="text-center text-sm text-red-400">{loadError}</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageSquare className="h-8 w-8 text-slate-600" />
            <p className="mt-2 text-sm text-slate-500">
              No messages yet. Send one below to start the conversation.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.origin === "client" ? "justify-end" : "justify-start")}
            >
              <div
                className="max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm"
                style={
                  m.origin === "client"
                    ? { backgroundColor: "var(--brand)", color: "white" }
                    : { backgroundColor: "rgba(255,255,255,0.06)", color: "#e2e8f0" }
                }
              >
                {m.subject && <p className="mb-1 text-xs font-semibold opacity-80">{m.subject}</p>}
                <p className="whitespace-pre-wrap">{m.body || "(no content)"}</p>
                {m.dateAdded && (
                  <p className="mt-1 text-[10px] opacity-60">
                    {new Date(m.dateAdded).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 bg-[#1a1a2e] p-3">
        {channel === "Email" && (
          <input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            placeholder={channel === "SMS" ? "Type an SMS…" : "Type an email…"}
            rows={2}
            className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--brand)" }}
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-right text-xs text-slate-500">
          {text.length}/{MAX_LENGTH}
        </p>
      </div>
    </div>
  );
}
