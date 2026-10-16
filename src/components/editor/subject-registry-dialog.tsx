"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  subjectRegistrySchema,
  type Subject,
} from "@/video/sequence-direction";
import { useReplanMotionDirection } from "@/hooks/script";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SubjectRegistryDialog({
  scriptId,
  subjects = [],
}: {
  scriptId: string;
  subjects?: Subject[];
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(subjects),
    [query, setQuery] = useState("");
  const save = useReplanMotionDirection(scriptId);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) setDraft(subjects);
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Subject identities
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recurring subject identities</DialogTitle>
          <DialogDescription>
            Exact labels share an identity. Add aliases only when they name the
            same subject. Colors use your brand tokens. To merge entries, remove
            one and add its label as an alias of the retained subject before
            saving. Saving replans unlocked scenes.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Find subject"
          placeholder="Find a subject…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!draft.length && (
          <p className="text-muted-foreground text-sm">
            Enable Sequence direction to register the subjects in your saved
            scenes.
          </p>
        )}
        {draft
          .map((subject, index) => ({ subject, index }))
          .filter(({ subject }) =>
            `${subject.label} ${subject.aliases.join(" ")}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .slice(0, 60)
          .map(({ subject, index }) => (
            <div key={subject.id} className="space-y-2 rounded border p-3">
              <strong className="text-sm">{subject.label}</strong>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDraft(draft.filter((_, i) => i !== index))}
              >
                Remove entry
              </Button>
              <label className="block text-xs">
                Aliases, one per line
                <textarea
                  className="bg-background mt-1 block w-full rounded border p-2"
                  aria-label={`Aliases for ${subject.label}`}
                  value={subject.aliases.join("\n")}
                  onChange={(e) =>
                    setDraft(
                      draft.map((s, i) =>
                        i === index
                          ? {
                              ...s,
                              aliases: e.target.value.split("\n"),
                            }
                          : s,
                      ),
                    )
                  }
                />
              </label>
              <label className="text-xs">
                Subject color{" "}
                <select
                  className="bg-background rounded border p-1"
                  aria-label={`Color for ${subject.label}`}
                  value={subject.colorSlot}
                  onChange={(e) =>
                    setDraft(
                      draft.map((s, i) =>
                        i === index
                          ? {
                              ...s,
                              colorSlot: e.target.value as Subject["colorSlot"],
                            }
                          : s,
                      ),
                    )
                  }
                >
                  <option value="accent">Accent</option>
                  <option value="accentSecondary">Secondary accent</option>
                  <option value="foreground">Ink</option>
                </select>
              </label>
            </div>
          ))}
        {draft.length > 60 && (
          <p className="text-muted-foreground text-xs">
            Showing up to 60 matching subjects. Search to find others.
          </p>
        )}
        <Button
          disabled={save.isPending || !draft.length}
          onClick={() => {
            const parsed = subjectRegistrySchema.safeParse(
              draft.map((s) => ({
                ...s,
                aliases: s.aliases.map((a) => a.trim()).filter(Boolean),
              })),
            );
            if (!parsed.success) {
              toast.error(parsed.error.issues[0].message);
              return;
            }
            save.mutate(
              { sequenceDirection: true, subjectRegistry: parsed.data },
              {
                onSuccess: () => {
                  toast.success("Subject identities saved");
                  setOpen(false);
                },
                onError: (e) => toast.error(e.message),
              },
            );
          }}
        >
          Save identities and replan
        </Button>
      </DialogContent>
    </Dialog>
  );
}
