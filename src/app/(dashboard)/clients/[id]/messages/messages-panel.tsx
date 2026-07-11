"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea, Input } from "@/components/ui/field";
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

export function MessagesPanel({
  clientId,
  hasPhone,
  hasEmail,
  linked,
}: {
  clientId: string;
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
      const res = await fetch(`/api/ghl/messages?clientId=${clientId}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (channel === "Email" && !subject.trim()) {
      toast("Subject is required for email.", "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/ghl/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, type: channel, message: trimmed, subject: subject.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast(data.error ?? "Send failed.", "error");
      } else {
        setText("");
        setSubject("");
        toast(`${channel} sent.`, "success");
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
      <Card>
        <EmptyState
          icon={MessageSquare}
          title="Not linked to GoHighLevel"
          description="This client has no GHL contact id, so there's no conversation to show. Sync this client to GHL first."
        />
      </Card>
    );
  }

  return (
    <Card className="flex h-[600px] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
        <div className="flex gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {(["SMS", "Email"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              disabled={c === "SMS" ? !hasPhone : !hasEmail}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                channel === c
                  ? "bg-violet-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : loadError ? (
          <p className="text-center text-sm text-red-400">{loadError}</p>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="Send an SMS or email to start the conversation."
          />
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.origin === "staff" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm",
                  m.origin === "staff"
                    ? "bg-violet-600 text-white"
                    : "bg-white/[0.06] text-slate-200"
                )}
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

      <div className="space-y-2 border-t border-white/[0.08] px-5 py-4">
        {channel === "Email" && (
          <Input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
          />
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            placeholder={channel === "SMS" ? "Type an SMS…" : "Type an email…"}
            rows={2}
            className="min-h-[44px]"
          />
          <Button onClick={send} loading={sending} disabled={!text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-right text-xs text-slate-500">
          {text.length}/{MAX_LENGTH}
        </p>
      </div>
    </Card>
  );
}
