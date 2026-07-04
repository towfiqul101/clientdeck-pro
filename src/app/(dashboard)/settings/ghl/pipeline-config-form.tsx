"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updatePipelineConfig } from "../actions";
import type { PipelineStageKey } from "@/lib/ghl/pipeline";

const STAGES: { key: PipelineStageKey; label: string }[] = [
  { key: "round_1_sent", label: "Round 1 Sent" },
  { key: "round_2_plus", label: "Round 2+ Sent" },
  { key: "goal_achieved", label: "Goal Achieved" },
];

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
