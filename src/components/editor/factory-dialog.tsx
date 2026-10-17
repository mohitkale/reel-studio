"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FactoryPanel } from "@/components/production/factory-panel";
export function FactoryDialog({
  scriptId,
  voiceTakeId,
}: {
  scriptId: string;
  voiceTakeId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Factory
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Content factory</DialogTitle>
          <DialogDescription>
            Make series and format variants from frozen film revisions.
          </DialogDescription>
        </DialogHeader>
        {open && <FactoryPanel scriptId={scriptId} voiceTakeId={voiceTakeId} />}
      </DialogContent>
    </Dialog>
  );
}
