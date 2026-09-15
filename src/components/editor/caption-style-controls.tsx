"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  CAPTION_STYLE_PRESETS,
  captionStyleSnapshotSchema,
  captionStyleWarnings,
  type CaptionStyleId,
  type CaptionStyleSnapshot,
} from "@/lib/caption-style";

const STYLE_LABELS: Record<CaptionStyleId, string> = {
  legacy: "Legacy 0.4",
  minimal: "Minimal",
  editorial: "Editorial",
  karaoke: "Karaoke",
  technical: "Technical",
  cinematic: "Cinematic",
};

function fontStack(style: CaptionStyleSnapshot): string {
  switch (style.fontFamily) {
    case "display":
      return "var(--font-geist-sans), system-ui, sans-serif";
    case "serif":
      return 'Georgia, "Times New Roman", serif';
    case "mono":
      return "var(--font-geist-mono), ui-monospace, monospace";
    default:
      return "var(--font-geist-sans), system-ui, sans-serif";
  }
}

function rgba(hex: string, opacity: number): string {
  const value = hex.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Label className="text-muted-foreground grid gap-1.5 text-xs">
      {label}
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Label className="text-muted-foreground grid gap-1.5 text-xs">
      {label}
      <span className="flex items-center gap-2">
        <Input
          type="color"
          className="h-9 w-12 cursor-pointer p-1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          value={value}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </Label>
  );
}

export function CaptionStyleControls({
  value,
  saving,
  onSave,
}: {
  value: CaptionStyleSnapshot;
  saving: boolean;
  onSave: (style: CaptionStyleSnapshot) => void;
}) {
  const [draft, setDraft] = React.useState(value);

  function update<K extends keyof CaptionStyleSnapshot>(
    key: K,
    next: CaptionStyleSnapshot[K],
  ) {
    setDraft((current) => ({ ...current, [key]: next }));
  }

  const parsed = captionStyleSnapshotSchema.safeParse(draft);
  const warnings = parsed.success ? captionStyleWarnings(parsed.data) : [];
  const shadow = `${draft.shadowOffsetX}px ${draft.shadowOffsetY}px ${draft.shadowBlur}px ${rgba(draft.shadowColor, draft.shadowOpacity)}`;
  const outline =
    draft.outlineWidth > 0
      ? `${draft.outlineWidth}px ${draft.outlineColor}`
      : undefined;

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex items-end justify-between gap-3">
        <Label className="grid flex-1 gap-1.5 text-xs">
          Style preset
          <NativeSelect
            value={draft.presetId}
            onChange={(event) =>
              setDraft(
                CAPTION_STYLE_PRESETS[event.target.value as CaptionStyleId],
              )
            }
          >
            {Object.entries(STYLE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Label>
        <Button
          size="sm"
          disabled={saving || !parsed.success}
          onClick={() => parsed.success && onSave(parsed.data)}
        >
          {saving ? "Saving…" : "Save style"}
        </Button>
      </div>

      <div
        className="bg-muted relative flex min-h-44 overflow-hidden rounded-lg border p-5"
        style={{
          alignItems:
            draft.position === "top"
              ? "flex-start"
              : draft.position === "center"
                ? "center"
                : "flex-end",
          justifyContent:
            draft.alignment === "left"
              ? "flex-start"
              : draft.alignment === "right"
                ? "flex-end"
                : "center",
        }}
      >
        <div
          dir="auto"
          style={{
            maxWidth: "92%",
            padding: `${draft.paddingY / 2}px ${draft.paddingX / 2}px`,
            borderRadius: draft.radius / 2,
            background: rgba(draft.backgroundColor, draft.backgroundOpacity),
            color: draft.textColor,
            fontFamily: fontStack(draft),
            fontSize: Math.max(12, draft.fontSize / 2),
            fontWeight: draft.fontWeight,
            lineHeight: draft.lineHeight,
            letterSpacing: `${draft.letterSpacing}em`,
            textAlign: draft.alignment,
            textShadow: shadow,
            WebkitTextStroke: outline,
            overflowWrap: "anywhere",
          }}
        >
          Captions stay readable with an{" "}
          <span style={{ color: draft.activeWordColor }}>active word</span>.
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Label className="text-muted-foreground grid gap-1.5 text-xs">
          Font
          <NativeSelect
            value={draft.fontFamily}
            onChange={(event) =>
              update(
                "fontFamily",
                event.target.value as CaptionStyleSnapshot["fontFamily"],
              )
            }
          >
            <option value="brand">Brand font</option>
            <option value="sans">Sans</option>
            <option value="display">Display</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </NativeSelect>
        </Label>
        <NumberField
          label="Size"
          value={draft.fontSize}
          min={20}
          max={96}
          onChange={(value) => update("fontSize", value)}
        />
        <Label className="text-muted-foreground grid gap-1.5 text-xs">
          Weight
          <NativeSelect
            value={draft.fontWeight}
            onChange={(event) =>
              update(
                "fontWeight",
                Number(
                  event.target.value,
                ) as CaptionStyleSnapshot["fontWeight"],
              )
            }
          >
            {[400, 500, 600, 700, 800, 900].map((weight) => (
              <option key={weight} value={weight}>
                {weight}
              </option>
            ))}
          </NativeSelect>
        </Label>
        <NumberField
          label="Line height"
          value={draft.lineHeight}
          min={0.9}
          max={1.6}
          step={0.05}
          onChange={(value) => update("lineHeight", value)}
        />
        <NumberField
          label="Letter spacing (em)"
          value={draft.letterSpacing}
          min={-0.08}
          max={0.2}
          step={0.01}
          onChange={(value) => update("letterSpacing", value)}
        />
        <Label className="text-muted-foreground grid gap-1.5 text-xs">
          Position
          <NativeSelect
            value={draft.position}
            onChange={(event) =>
              update(
                "position",
                event.target.value as CaptionStyleSnapshot["position"],
              )
            }
          >
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </NativeSelect>
        </Label>
        <Label className="text-muted-foreground grid gap-1.5 text-xs">
          Alignment
          <NativeSelect
            value={draft.alignment}
            onChange={(event) =>
              update(
                "alignment",
                event.target.value as CaptionStyleSnapshot["alignment"],
              )
            }
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </NativeSelect>
        </Label>
        <Label className="text-muted-foreground grid gap-1.5 text-xs">
          Highlight
          <NativeSelect
            value={draft.highlightMode}
            onChange={(event) =>
              update(
                "highlightMode",
                event.target.value as CaptionStyleSnapshot["highlightMode"],
              )
            }
          >
            <option value="none">None</option>
            <option value="word">Active word</option>
            <option value="phrase">Phrase</option>
            <option value="karaoke">Karaoke</option>
          </NativeSelect>
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ColorField
          label="Text"
          value={draft.textColor}
          onChange={(value) => update("textColor", value)}
        />
        <ColorField
          label="Active word"
          value={draft.activeWordColor}
          onChange={(value) => update("activeWordColor", value)}
        />
        <ColorField
          label="Caption box"
          value={draft.backgroundColor}
          onChange={(value) => update("backgroundColor", value)}
        />
        <NumberField
          label="Box opacity"
          value={draft.backgroundOpacity}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) => update("backgroundOpacity", value)}
        />
        <NumberField
          label="Horizontal padding"
          value={draft.paddingX}
          min={0}
          max={64}
          onChange={(value) => update("paddingX", value)}
        />
        <NumberField
          label="Vertical padding"
          value={draft.paddingY}
          min={0}
          max={48}
          onChange={(value) => update("paddingY", value)}
        />
        <NumberField
          label="Corner radius"
          value={draft.radius}
          min={0}
          max={64}
          onChange={(value) => update("radius", value)}
        />
        <NumberField
          label="Outline width"
          value={draft.outlineWidth}
          min={0}
          max={8}
          step={0.5}
          onChange={(value) => update("outlineWidth", value)}
        />
        <ColorField
          label="Outline"
          value={draft.outlineColor}
          onChange={(value) => update("outlineColor", value)}
        />
        <NumberField
          label="Shadow opacity"
          value={draft.shadowOpacity}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) => update("shadowOpacity", value)}
        />
        <NumberField
          label="Shadow blur"
          value={draft.shadowBlur}
          min={0}
          max={48}
          onChange={(value) => update("shadowBlur", value)}
        />
        <NumberField
          label="Shadow X"
          value={draft.shadowOffsetX}
          min={-24}
          max={24}
          onChange={(value) => update("shadowOffsetX", value)}
        />
        <NumberField
          label="Shadow Y"
          value={draft.shadowOffsetY}
          min={-24}
          max={24}
          onChange={(value) => update("shadowOffsetY", value)}
        />
        <NumberField
          label="Words per line"
          value={draft.maxWordsPerLine}
          min={1}
          max={12}
          onChange={(value) => update("maxWordsPerLine", value)}
        />
        <NumberField
          label="Maximum lines"
          value={draft.maxLines}
          min={1}
          max={4}
          onChange={(value) => update("maxLines", value)}
        />
      </div>

      {!parsed.success ? (
        <p className="text-destructive text-xs">
          Fix the out-of-range or invalid style values before saving.
        </p>
      ) : null}
      {warnings.map((warning) => (
        <p key={warning} className="text-warning text-xs">
          {warning}
        </p>
      ))}
    </section>
  );
}
