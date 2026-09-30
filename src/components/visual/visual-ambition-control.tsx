"use client";

import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  VISUAL_AMBITIONS,
  VISUAL_AMBITION_LABELS,
  VISUAL_AMBITION_DESCRIPTIONS,
  type VisualAmbition,
} from "@/production/motion-plan";

export function VisualAmbitionControl({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: VisualAmbition;
  onChange(value: VisualAmbition): void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Visual ambition</Label>
      <NativeSelect
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as VisualAmbition)}
      >
        {VISUAL_AMBITIONS.map((ambition) => (
          <option key={ambition} value={ambition}>
            {VISUAL_AMBITION_LABELS[ambition]}
          </option>
        ))}
      </NativeSelect>
      <p className="text-muted-foreground text-xs">
        {VISUAL_AMBITION_DESCRIPTIONS[value]}
      </p>
    </div>
  );
}
