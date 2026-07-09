"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateBranding } from "../actions";
import { Upload, Loader2 } from "lucide-react";

const STORAGE_BUCKET = "agency-assets";

interface BrandingFormProps {
  agencyId: string;
  agencyName: string;
  initial: {
    logoUrl: string | null;
    brandColor: string;
  };
}

export function BrandingForm({
  agencyId,
  agencyName,
  initial,
}: BrandingFormProps) {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [brandColor, setBrandColor] = useState(initial.brandColor);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file.", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast("Logo must be under 2 MB.", "error");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `${agencyId}/logo-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (error) {
      setUploading(false);
      toast(`Upload failed: ${error.message}`, "error");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    setLogoUrl(publicUrl);
    setUploading(false);
    toast("Logo uploaded. Don't forget to save.", "info");
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateBranding({ logoUrl, brandColor });
    setSaving(false);
    if (result.success) toast("Branding saved.", "success");
    else toast(result.error ?? "Could not save branding.", "error");
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-5 p-6">
          <Field label="Agency logo" htmlFor="logo">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Agency logo"
                    width={64}
                    height={64}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="text-xs text-slate-500">No logo</span>
                )}
              </div>
              <div>
                <input
                  ref={fileInput}
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? "Uploading…" : "Upload logo"}
                </Button>
                <p className="mt-1.5 text-xs text-slate-500">
                  PNG or SVG, up to 2 MB.
                </p>
              </div>
            </div>
          </Field>

          <Field label="Brand color" htmlFor="brandColor">
            <div className="flex items-center gap-3">
              <input
                id="brandColor"
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border border-white/10 bg-[#1a1a2e] p-1"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-32 rounded-md border border-white/10 px-3 py-2 font-mono text-sm uppercase text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </Field>
        </div>
      </Card>

      {/* Live preview */}
      <Card>
        <CardHeader
          title="Portal preview"
          description="How your client portal header will look."
        />
        <div className="p-6">
          <div className="overflow-hidden rounded-lg border border-white/10">
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{ backgroundColor: brandColor }}
            >
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Logo preview"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded object-contain bg-white/90 p-0.5"
                  unoptimized
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded bg-white/20 text-sm font-semibold text-white">
                  {agencyName.charAt(0)}
                </span>
              )}
              <span className="font-semibold text-white">{agencyName}</span>
            </div>
            <div className="space-y-2 bg-[#1a1a2e] p-5">
              <div className="h-3 w-1/3 rounded bg-white/[0.06]" />
              <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
              <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} loading={saving}>
          Save branding
        </Button>
      </div>
    </div>
  );
}
