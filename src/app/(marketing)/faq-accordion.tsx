"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/helpers";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Do I need GoHighLevel?",
    a: "GHL is required for the sync features. If you don't have GHL, the dispute management and client portal still work, but automations won't fire.",
  },
  {
    q: "Can I import clients from CDM/DisputeFox?",
    a: "Yes — CSV import is available.",
  },
  {
    q: "Is this legal / FCRA compliant?",
    a: "ClientDeck Pro is practice management software. Letters are templates for professional review. You are responsible for compliance in your jurisdiction.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "Export everything before cancelling. We retain data for 30 days after cancellation.",
  },
  {
    q: "Do you offer a white-label?",
    a: "Yes — the Pro plan includes white-label portal branding. The Agency plan removes 'Powered by ClientDeck Pro' entirely.",
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-2xl divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
      {FAQS.map((faq, i) => (
        <div key={faq.q}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <span className="text-sm font-medium text-gray-900">{faq.q}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-gray-400 transition-transform",
                open === i && "rotate-180"
              )}
            />
          </button>
          {open === i && (
            <p className="px-5 pb-4 text-sm text-gray-600">{faq.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}
