"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";

import { VoiceClonePanel } from "@/components/voice/voice-clone-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Opens the VoiceForge clone flow in a dialog (editor + anywhere else). */
export function VoiceCloneDialog({
  configured,
  preferredEngineId,
  onVoiceReady,
}: {
  configured: boolean;
  /** Pre-select this engine in the clone form (e.g. editor Engine dropdown). */
  preferredEngineId?: string;
  onVoiceReady?: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!configured}
          className="w-full"
        >
          <UserPlus className="mr-2 size-4" />
          Clone a voice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clone a voice with VoiceForge</DialogTitle>
          <DialogDescription>
            Upload or record a short sample. Processing runs on your local
            VoiceForge service.
          </DialogDescription>
        </DialogHeader>
        <VoiceClonePanel
          configured={configured}
          compact
          preferredEngineId={preferredEngineId}
          onSuccess={() => {
            onVoiceReady?.();
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
