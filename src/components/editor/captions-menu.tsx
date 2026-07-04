"use client";

import { Captions } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HintTooltip } from "@/components/ui/hint-tooltip";

/**
 * Download the reel's captions as SRT or VTT. The timing comes from the selected
 * take (or estimated when none) and matches the rendered MP4. The server sets the
 * filename via Content-Disposition.
 */
export function CaptionsMenu({
  scriptId,
  takeId,
  disabled,
}: {
  scriptId: string;
  takeId: string | null;
  disabled?: boolean;
}) {
  function download(format: "srt" | "vtt") {
    const params = new URLSearchParams({ format });
    if (takeId) params.set("takeId", takeId);
    const a = document.createElement("a");
    a.href = `/api/scripts/${scriptId}/captions?${params.toString()}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <DropdownMenu>
      <HintTooltip label="Download subtitles (SRT or VTT) synced to the selected take" side="bottom">
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Captions className="size-3.5" />
          Captions
        </Button>
      </DropdownMenuTrigger>
      </HintTooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Download subtitles</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => download("srt")}>
          SubRip (.srt)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => download("vtt")}>
          WebVTT (.vtt)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
