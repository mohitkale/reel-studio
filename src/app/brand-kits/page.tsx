"use client";

import * as React from "react";
import { Palette, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

import {
  useBrandKits,
  useCreateBrandKit,
  useUpdateBrandKit,
  useDeleteBrandKit,
  useSetDefaultBrandKit,
} from "@/hooks/brandkits";
import type { BrandKitDTO } from "@/lib/dto";
import type { BrandTokens } from "@/compositions/tokens";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const COLOR_FIELDS: { key: keyof BrandTokens; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "backgroundAccent", label: "Background accent" },
  { key: "foreground", label: "Foreground" },
  { key: "muted", label: "Muted" },
  { key: "accent", label: "Accent" },
  { key: "accentSecondary", label: "Accent secondary" },
  { key: "accentForeground", label: "Accent foreground" },
];

type EditState = {
  id: string;
  name: string;
  handle: string;
  colors: Record<string, string>;
};

function KitDialogForm({
  kit,
  onSave,
  onCancel,
  saving,
}: {
  kit: BrandKitDTO | null;
  onSave: (state: EditState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const initColors = (): Record<string, string> => {
    const c: Record<string, string> = {};
    if (kit) {
      for (const { key } of COLOR_FIELDS) {
        const val = kit.tokens[key as keyof BrandTokens];
        if (typeof val === "string") c[key] = val;
      }
    }
    return c;
  };

  const [name, setName] = React.useState(kit?.name ?? "");
  const [handle, setHandle] = React.useState(kit?.handle ?? "");
  const [colors, setColors] = React.useState<Record<string, string>>(initColors);

  function handleSave() {
    if (!name.trim()) { toast.error("Kit name is required"); return; }
    onSave({ id: kit?.id ?? "", name: name.trim(), handle: handle.trim(), colors });
  }

  const palette = COLOR_FIELDS.map(({ key }) => colors[key]).filter(Boolean);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{kit ? "Edit brand kit" : "New brand kit"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="kit-name">Name</Label>
            <Input
              id="kit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My brand kit"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kit-handle">Handle</Label>
            <Input
              id="kit-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@yourhandle"
            />
          </div>
        </div>

        {palette.length > 0 && (
          <div className="flex gap-1 rounded-lg overflow-hidden h-8">
            {palette.map((c, i) => (
              <div key={i} className="flex-1" style={{ background: c }} />
            ))}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {COLOR_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={colors[key] ?? "#000000"}
                onChange={(e) => setColors((p) => ({ ...p, [key]: e.target.value }))}
                className="h-8 w-8 cursor-pointer rounded border bg-transparent p-0.5"
                style={{ colorScheme: "dark" }}
              />
              <span className="text-sm">{label}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {colors[key] ?? "default"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save kit"}
        </Button>
      </DialogFooter>
    </>
  );
}

function KitDialog({
  open,
  onOpenChange,
  kit,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kit: BrandKitDTO | null;
  onSave: (state: EditState) => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <KitDialogForm
          key={`${kit?.id ?? "new"}-${open}`}
          kit={kit}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
          saving={saving}
        />
      </DialogContent>
    </Dialog>
  );
}

function KitCard({
  kit,
  onEdit,
  onDelete,
  onToggleDefault,
  settingDefault,
}: {
  kit: BrandKitDTO;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDefault: () => void;
  settingDefault: boolean;
}) {
  const palette = COLOR_FIELDS.map(({ key }) => {
    const val = kit.tokens[key as keyof BrandTokens];
    return typeof val === "string" ? val : null;
  }).filter(Boolean) as string[];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{kit.name}</p>
            {kit.isDefault && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">Default</Badge>
            )}
          </div>
          {kit.handle && (
            <p className="text-xs text-muted-foreground">{kit.handle}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-7", kit.isDefault ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            onClick={onToggleDefault}
            disabled={settingDefault}
            aria-label={kit.isDefault ? "Remove as default" : "Set as default"}
            title={kit.isDefault ? "Remove as default kit" : "Set as default kit for all projects"}
          >
            <Star className={cn("size-3.5", kit.isDefault && "fill-current")} />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={onEdit} aria-label="Edit kit">
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={onDelete} aria-label="Delete kit">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex gap-1 h-6 rounded overflow-hidden">
        {palette.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} title={c} />
        ))}
        {palette.length === 0 && (
          <div className="flex-1 rounded bg-muted text-center text-[10px] text-muted-foreground leading-6">
            Default palette
          </div>
        )}
      </div>

      <div className="flex gap-1 flex-wrap">
        <Badge variant="secondary" className="text-[10px]">
          {new Date(kit.createdAt).toLocaleDateString()}
        </Badge>
      </div>
    </div>
  );
}

export default function BrandKitsPage() {
  const { data: kits = [], isLoading } = useBrandKits();
  const createKit = useCreateBrandKit();
  const updateKit = useUpdateBrandKit();
  const deleteKit = useDeleteBrandKit();
  const setDefaultKit = useSetDefaultBrandKit();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingKit, setEditingKit] = React.useState<BrandKitDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<BrandKitDTO | null>(null);

  function openNew() {
    setEditingKit(null);
    setDialogOpen(true);
  }

  function openEdit(kit: BrandKitDTO) {
    setEditingKit(kit);
    setDialogOpen(true);
  }

  async function handleSave(state: EditState) {
    const palette: Record<string, string> = {};
    for (const [key, val] of Object.entries(state.colors)) {
      if (val) palette[key] = val;
    }

    try {
      if (editingKit) {
        await updateKit.mutateAsync({
          id: editingKit.id,
          name: state.name,
          handle: state.handle || null,
          palette,
        });
        toast.success("Brand kit updated");
      } else {
        const kit = await createKit.mutateAsync(state.name);
        if (Object.keys(palette).length > 0 || state.handle) {
          await updateKit.mutateAsync({
            id: kit.id,
            handle: state.handle || null,
            palette,
          });
        }
        toast.success("Brand kit created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save brand kit");
    }
  }

  function handleToggleDefault(kit: BrandKitDTO) {
    const willBeDefault = !kit.isDefault;
    setDefaultKit.mutate(
      { id: kit.id, isDefault: willBeDefault },
      {
        onSuccess: () =>
          toast.success(
            willBeDefault
              ? `"${kit.name}" is now the default kit`
              : "Default kit cleared",
          ),
        onError: () => toast.error("Failed to update default kit"),
      },
    );
  }

  const saving = createKit.isPending || updateKit.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand Kits"
        description="Create color palettes and style presets. Star a kit to make it the default for all projects."
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="size-3.5" />
            New kit
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : kits.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="No brand kits yet"
          description="Create a kit to define colors, a handle and font for a project. Star a kit to make it the default for all projects."
          action={
            <Button onClick={openNew}>
              <Plus className="size-3.5" />
              Create your first kit
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <KitCard
              key={kit.id}
              kit={kit}
              onEdit={() => openEdit(kit)}
              onDelete={() => setDeleteTarget(kit)}
              onToggleDefault={() => handleToggleDefault(kit)}
              settingDefault={setDefaultKit.isPending}
            />
          ))}
        </div>
      )}

      <KitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        kit={editingKit}
        onSave={handleSave}
        saving={saving}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete brand kit?"
        description={`"${deleteTarget?.name}" will be permanently removed. Projects using it will revert to the default style.`}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteKit.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
            onError: () => toast.error("Failed to delete kit"),
          });
        }}
        isPending={deleteKit.isPending}
      />
    </div>
  );
}
