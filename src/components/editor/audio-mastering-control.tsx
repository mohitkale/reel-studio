"use client";
import { useScript, useSetScriptMusic } from "@/hooks/script";
import { Button } from "@/components/ui/button";

export function AudioMasteringControl({
  scriptId,
  disabled,
}: {
  scriptId: string;
  disabled?: boolean;
}) {
  const { data: script } = useScript(scriptId);
  const save = useSetScriptMusic(scriptId);
  const balanced = script?.audioMastering === "balanced";
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <Button
        size="sm"
        variant={balanced ? "default" : "outline"}
        aria-pressed={balanced}
        disabled={!script || disabled || save.isPending}
        onClick={() =>
          save.mutate({ audioMastering: balanced ? "original" : "balanced" })
        }
      >
        Balance export loudness{balanced ? " · on" : ""}
      </Button>
      <p className="text-muted-foreground text-xs">
        Optional finishing for the complete export mix. Targets −16 LUFS with
        true peak below −1 dBTP; the encoded result is measured before delivery.
        Silent or unmeasurable audio stays untouched. Editor playback uses your
        current mix levels.
      </p>
      {save.isError && (
        <p role="alert" className="text-destructive text-xs">
          {save.error.message}
        </p>
      )}
    </div>
  );
}
