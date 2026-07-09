"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updatePipelineConfig } from "../actions";
import {
  PIPELINE_STAGE_KEYS,
  PIPELINE_STAGE_LABELS,
  type PipelineStageKey,
} from "@/lib/ghl/pipeline";

const STAGES: { key: PipelineStageKey; label: string }[] = PIPELINE_STAGE_KEYS.map(
  (key) => ({ key, label: PIPELINE_STAGE_LABELS[key] })
);

interface PipelineConfigFormProps {
  initial: {
    pipelineId: string;
    stages: Partial<Record<PipelineStageKey, string>>;
  };
}

export function PipelineConfigForm({ initial }: PipelineConfigFormProps) {
  const { toast } = useToast();
  const [pipelineId, setPipelineId] = useState(initial.pipelineId);
  const [stages, setStages] = useState(initial.stages);
  const [pending, setPending] = useState(false);

  const mappedCount = STAGES.filter(({ key }) => (stages[key] ?? "").trim()).length;

  function setStage(key: PipelineStageKey, value: string) {
    setStages((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setPending(true);
    const result = await updatePipelineConfig({ pipelineId, stages });
    setPending(false);
    if (result.success) toast("Pipeline configuration saved.", "success");
    else toast(result.error ?? "Could not save.", "error");
  }

  return (
    <Card>
      <CardHeader
        title="Pipeline Configuration"
        description="Automatically move a client's GHL opportunity into the right stage of your Active Client pipeline as rounds progress. Paste the pipeline id and stage ids from GHL — Settings → Pipelines → open the pipeline, and copy ids from the URL/API."
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
          <span className="font-medium text-slate-200">
            {pipelineId ? "Pipeline connected" : "No pipeline connected"}
          </span>
          <span className="text-slate-500">
            {mappedCount} of {STAGES.length} stages mapped
          </span>
          {pipelineId && mappedCount < STAGES.length && (
            <span className="text-amber-400">
              Fill the remaining stage ids below (or re-run &ldquo;Find &amp; Connect Pipeline&rdquo;).
            </span>
          )}
        </div>
        <Field label="Pipeline ID" htmlFor="pipelineId">
          <Input
            id="pipelineId"
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            placeholder="e.g. 5f9c2b1a3e4d5f6a7b8c9d0e"
            className="font-mono text-xs"
          />
        </Field>
        {STAGES.map(({ key, label }) => (
          <Field key={key} label={label} htmlFor={key}>
            <Input
              id={key}
              value={stages[key] ?? ""}
              onChange={(e) => setStage(key, e.target.value)}
              placeholder="Stage id from GHL"
              className="font-mono text-xs"
            />
          </Field>
        ))}
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={pending}>
            Save Pipeline Config
          </Button>
        </div>
      </div>
    </Card>
  );
}
