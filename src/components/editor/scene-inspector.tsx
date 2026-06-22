"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import type { SceneDTO } from "@/lib/dto";
import { TEMPLATES } from "@/compositions/templates";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Edits one scene. Mount with key={scene.id} so local draft state resets when a
 * different scene is selected. Text/emphasis commit on blur; template on change.
 */
export function SceneInspector({
  scene,
  onUpdate,
  onDelete,
  saving,
}: {
  scene: SceneDTO;
  onUpdate: (vars: {
    id: string;
    text?: string;
    templateId?: string;
    emphasis?: string[];
  }) => void;
  onDelete: (id: string) => void;
  saving?: boolean;
}) {
  const [text, setText] = React.useState(scene.text);
  const [emphasis, setEmphasis] = React.useState(scene.emphasis.join(", "));

  function commitText() {
    if (text !== scene.text) onUpdate({ id: scene.id, text });
  }

  function commitEmphasis() {
    const parsed = emphasis
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.join("|") !== scene.emphasis.join("|")) {
      onUpdate({ id: scene.id, emphasis: parsed });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Scene</h3>
        {saving ? (
          <span className="text-xs text-muted-foreground">Saving...</span>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="scene-text">Text</Label>
        <Textarea
          id="scene-text"
          value={text}
          rows={4}
          placeholder="What is said in this scene"
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="scene-template">Template</Label>
        <NativeSelect
          id="scene-template"
          value={scene.templateId}
          onChange={(e) => onUpdate({ id: scene.id, templateId: e.target.value })}
        >
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {TEMPLATES.find((t) => t.id === scene.templateId)?.description}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="scene-emphasis">Emphasis (comma separated)</Label>
        <Input
          id="scene-emphasis"
          value={emphasis}
          placeholder="key phrase, another phrase"
          onChange={(e) => setEmphasis(e.target.value)}
          onBlur={commitEmphasis}
        />
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(scene.id)}
      >
        <Trash2 />
        Delete scene
      </Button>
    </div>
  );
}
