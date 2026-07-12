"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { connectDomain, checkDomainVerification, removeDomain } from "../actions";
import type { VerificationChallenge } from "@/lib/vercel/domains";

interface DomainFormProps {
  initial: {
    domain: string | null;
    verified: boolean;
    ownershipChallenge: VerificationChallenge | null;
    recommendedCname: string | null;
  };
}

export function DomainForm({ initial }: DomainFormProps) {
  const { toast } = useToast();
  const [domain, setDomain] = useState(initial.domain ?? "");
  const [input, setInput] = useState("");
  const [verified, setVerified] = useState(initial.verified);
  const [ownershipChallenge, setOwnershipChallenge] = useState(initial.ownershipChallenge);
  const [recommendedCname, setRecommendedCname] = useState(initial.recommendedCname);
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleConnect() {
    if (!input.trim()) return;
    setConnecting(true);
    const result = await connectDomain(input.trim());
    setConnecting(false);
    if (!result.success) {
      toast(result.error ?? "Could not connect domain.", "error");
      return;
    }
    setDomain(input.trim().toLowerCase());
    setInput("");
    setVerified(false);
    setOwnershipChallenge(result.ownershipChallenge ?? null);
    setRecommendedCname(result.recommendedCname ?? null);
    toast("Domain connected — complete DNS verification below.", "success");
  }

  async function handleVerify() {
    setVerifying(true);
    const result = await checkDomainVerification();
    setVerifying(false);
    if (result.verified) {
      setVerified(true);
      toast("Domain verified! Portal links will now use this domain.", "success");
    } else {
      toast("Not verified yet — DNS changes can take a few minutes to propagate.", "error");
    }
  }

  async function handleRemove() {
    if (!window.confirm(`Remove ${domain}? Portal links will go back to using the default domain.`)) {
      return;
    }
    setRemoving(true);
    const result = await removeDomain();
    setRemoving(false);
    if (!result.success) {
      toast(result.error ?? "Could not remove domain.", "error");
      return;
    }
    setDomain("");
    setVerified(false);
    setOwnershipChallenge(null);
    setRecommendedCname(null);
    toast("Domain removed.", "success");
  }

  return (
    <Card>
      <CardHeader
        title="Custom Portal Domain"
        description="White-label your client portal on your own domain (e.g. portal.youragency.com) instead of roundtrackpro.com."
      />
      <div className="space-y-5 p-6">
        {!domain && (
          <>
            <Field label="Domain" htmlFor="domain">
              <Input
                id="domain"
                placeholder="portal.youragency.com"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
            <div className="flex justify-end">
              <Button onClick={handleConnect} loading={connecting}>
                Connect
              </Button>
            </div>
          </>
        )}

        {domain && !verified && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              <span className="font-mono">{domain}</span> is connected but not verified yet.
            </p>

            {ownershipChallenge ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <p className="font-medium text-amber-300">
                  This domain is already connected to another project.
                </p>
                <p className="mt-1 text-slate-400">
                  To claim it here, add this TXT record to prove ownership:
                </p>
                <div className="mt-2 space-y-1 font-mono text-xs text-slate-300">
                  <div>Type: TXT</div>
                  <div>Name: {ownershipChallenge.domain}</div>
                  <div>Value: {ownershipChallenge.value}</div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-[#1a1a2e] p-4 text-sm">
                <p className="text-slate-400">Add this DNS record:</p>
                <div className="mt-2 space-y-1 font-mono text-xs text-slate-300">
                  <div>Type: CNAME</div>
                  <div>Name: {domain.split(".")[0]}</div>
                  <div>Value: {recommendedCname ?? "cname.vercel-dns.com"}</div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleRemove} loading={removing}>
                Cancel
              </Button>
              <Button onClick={handleVerify} loading={verifying}>
                Verify
              </Button>
            </div>
          </div>
        )}

        {domain && verified && (
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#1a1a2e] p-4">
            <div>
              <p className="text-sm font-medium text-slate-100">{domain}</p>
              <p className="text-xs text-emerald-400">Verified — live</p>
            </div>
            <Button type="button" variant="secondary" onClick={handleRemove} loading={removing}>
              Remove domain
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
