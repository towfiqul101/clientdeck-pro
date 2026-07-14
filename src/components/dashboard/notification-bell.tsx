"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils/helpers";
import type { StaffNotification } from "@/types";

type StaffNotificationItem = Pick<
  StaffNotification,
  "id" | "type" | "message" | "link" | "read_at" | "created_at"
>;

const POLL_MS = 30_000;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function subscribeToPush(): Promise<boolean> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  return true;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<StaffNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Silent — next poll retries.
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushEnabled(true); // Unsupported browser — hide the prompt instead of nagging.
      return;
    }
    if (Notification.permission === "granted") {
      setPushEnabled(true);
      // Permission was already granted (e.g. via the client portal's push
      // prompt on the same browser) — no UI prompt will ever call
      // subscribeToPush() in that case, so ensure a push_subscriptions row
      // exists for this staff member here. Idempotent: pushManager.subscribe()
      // returns the existing subscription if already subscribed, and the
      // server upsert is onConflict:"endpoint".
      subscribeToPush().catch(() => {});
    } else {
      setPushEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleEnablePush() {
    const ok = await subscribeToPush().catch(() => false);
    setPushEnabled(ok || (typeof Notification !== "undefined" && Notification.permission === "granted"));
  }

  async function handleItemClick(item: StaffNotificationItem) {
    setOpen(false);
    if (item.read_at) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await fetch(`/api/notifications/${item.id}/read`, { method: "POST" }).catch(() => {});
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
          style={{ background: "var(--overlay-surface)", borderColor: "var(--overlay-border)" }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--overlay-divide)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--overlay-text)" }}>
              Notifications
            </p>
          </div>

          {pushEnabled === false && (
            <div className="border-b px-4 py-3" style={{ borderColor: "var(--overlay-divide)" }}>
              <p className="text-xs" style={{ color: "var(--overlay-text-muted)" }}>
                Turn on push notifications to get alerted even when this tab isn&apos;t open.
              </p>
              <button
                onClick={handleEnablePush}
                className="mt-2 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
              >
                Enable push notifications
              </button>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--overlay-text-muted)" }}>
                No notifications yet.
              </p>
            ) : (
              notifications.map((item) => (
                <Link
                  key={item.id}
                  href={item.link ?? "/dashboard"}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "block border-b px-4 py-3 text-sm transition-colors hover:bg-white/5",
                    !item.read_at && "bg-violet-500/[0.06]"
                  )}
                  style={{ borderColor: "var(--overlay-divide)" }}
                >
                  <p style={{ color: "var(--overlay-text)" }}>{item.message}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--overlay-text-muted)" }}>
                    {timeAgo(item.created_at)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
