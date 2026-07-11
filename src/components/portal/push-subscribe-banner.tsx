"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const DISMISS_KEY = "rtp_push_banner_dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function saveSubscription(subscription: PushSubscription) {
  await fetch("/api/portal/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
}

export function PushSubscribeBanner() {
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    (async () => {
      const registration = await navigator.serviceWorker.register("/sw.js");

      if (Notification.permission === "granted") {
        // Permission already granted (e.g. a prior visit). Make sure the
        // subscription still exists and is saved server-side without
        // prompting the user again.
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await saveSubscription(existing).catch(() => {});
        } else {
          try {
            const sub = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });
            await saveSubscription(sub);
          } catch {
            // Silent — will show the banner-driven flow on next opportunity.
          }
        }
        return;
      }

      if (Notification.permission === "denied") return;
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      setVisible(true);
    })();
  }, []);

  async function handleEnable() {
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await saveSubscription(sub);
      toast("Notifications enabled.", "success");
      setVisible(false);
    } catch {
      toast("Couldn't enable notifications. Try again.", "error");
    } finally {
      setSubscribing(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-slate-100">Get notified about your progress</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Turn on notifications to know as soon as there's an update — new dispute rounds, deletions, and messages.
        </p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={handleEnable} loading={subscribing}>
            Enable notifications
          </Button>
          <Button size="sm" variant="secondary" onClick={handleDismiss}>
            Not now
          </Button>
        </div>
      </div>
      <button onClick={handleDismiss} className="text-slate-500 hover:text-slate-300" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
