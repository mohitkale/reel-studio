"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAssets } from "@/hooks/assets";
import type { AssetDTO, ScriptDTO } from "@/lib/dto";
import type {
  ProductProof,
  ProductProofControl,
  ProductProofPreview,
} from "@/production/product-proof";
import { apiGet, apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Context = {
  sourceHash: string;
  plan?: ProductProof;
  findings: Array<{ featureId?: string; sceneId?: string; message: string }>;
};
export function ProductProofPanel({ script }: { script: ScriptDTO }) {
  const client = useQueryClient(),
    { data: assets = [] } = useAssets();
  const query = useQuery({
    queryKey: ["product-proof", script.id],
    queryFn: () => apiGet<Context>(`/api/scripts/${script.id}/product-proof`),
  });
  useEffect(() => {
    void client.invalidateQueries({ queryKey: ["product-proof", script.id] });
  }, [client, script]);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<ProductProofPreview | null>(null);
  const [label, setLabel] = useState(""),
    [subjectLabel, setSubject] = useState("Product"),
    [sceneIds, setScenes] = useState<string[]>(
      script.scenes[0] ? [script.scenes[0].id] : [],
    ),
    [assetId, setAsset] = useState(""),
    [cue, setCue] = useState(0);
  const media = assets.filter(
    (asset) => asset.type === "image" || asset.type === "video",
  );
  async function action(input: ProductProofControl) {
    setPending(true);
    setError("");
    try {
      const result = await apiPost<
        ProductProofPreview | { state: "saved"; plan: ProductProof }
      >(`/api/scripts/${script.id}/product-proof`, input);
      if (result.state === "preview") setPreview(result);
      else {
        setPreview(null);
        await Promise.all([
          client.invalidateQueries({ queryKey: ["product-proof", script.id] }),
          client.invalidateQueries({ queryKey: ["script", script.id] }),
          client.invalidateQueries({ queryKey: ["scene-history", script.id] }),
        ]);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Proof mapping failed");
    } finally {
      setPending(false);
    }
  }
  const features = query.data?.plan?.features ?? [];
  const featureInputs = features.map((feature) => ({
    id: feature.id,
    label: feature.label,
    subjectLabel: feature.subjectLabel,
    sceneIds: feature.sceneIds,
    assets: feature.assets,
  }));
  const name = (id: string) =>
    media.find((asset) => asset.id === id)?.name ?? "Supplied artifact";
  return (
    <details
      className="bg-card rounded-xl border p-4"
      open={
        script.productionPreset?.id === "product-launch" ||
        Boolean(features.length)
      }
    >
      <summary className="cursor-pointer font-semibold">
        Product proof and recurring subjects
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted-foreground text-sm">
          Map real supplied screenshots or recordings to the feature they
          demonstrate. Matching a file does not verify a claim or customer
          outcome. This workflow uses no writer, research, stock-search or voice
          call.
        </p>
        {(error || query.error) && (
          <p role="alert">{error || query.error?.message}</p>
        )}
        {query.data?.findings.map((finding, index) => (
          <p className="text-sm" key={index}>
            Review: {finding.message}
          </p>
        ))}
        <fieldset
          disabled={pending}
          className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
        >
          <label className="min-w-0 text-sm">
            Feature
            <Input
              aria-label="Proof feature"
              value={label}
              maxLength={160}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label className="text-sm">
            Recurring subject
            <Input
              aria-label="Proof recurring subject"
              value={subjectLabel}
              maxLength={96}
              onChange={(event) => setSubject(event.target.value)}
            />
          </label>
          <label className="text-sm">
            Supplied artifact
            <select
              aria-label="Proof artifact"
              className="bg-background mt-1 w-full rounded border p-2"
              value={assetId}
              onChange={(event) => {
                setAsset(event.target.value);
                setCue(0);
              }}
            >
              <option value="">No supplied proof yet</option>
              {media.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.type} · {asset.name ?? "Unnamed artifact"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Recording start (seconds)
            <Input
              aria-label="Proof recording start"
              type="number"
              min={0}
              max={3600}
              step={0.1}
              disabled={
                media.find((asset) => asset.id === assetId)?.type !== "video"
              }
              value={cue}
              onChange={(event) => setCue(Number(event.target.value))}
            />
          </label>
          <div className="space-y-1 sm:col-span-2">
            <p className="text-sm font-medium">
              Scenes demonstrating this feature
            </p>
            <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
              {script.scenes.map((scene, index) => (
                <label
                  key={scene.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={sceneIds.includes(scene.id)}
                    onChange={(event) =>
                      setScenes(
                        event.target.checked
                          ? [...sceneIds, scene.id]
                          : sceneIds.filter((id) => id !== scene.id),
                      )
                    }
                  />
                  {index + 1}. {scene.text.slice(0, 70)}
                </label>
              ))}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={
              !query.data ||
              pending ||
              label.trim().length < 2 ||
              subjectLabel.trim().length < 2 ||
              !sceneIds.length
            }
            onClick={() => {
              if (query.data)
                void action({
                  action: "save",
                  expectedHash: query.data.sourceHash,
                  features: [
                    ...featureInputs,
                    {
                      id: `feature-${crypto.randomUUID()}`,
                      label,
                      subjectLabel,
                      sceneIds,
                      assets: assetId ? [{ assetId, startSeconds: cue }] : [],
                    },
                  ],
                });
            }}
          >
            Save feature mapping
          </Button>
        </fieldset>
        {features.map((feature) => (
          <article
            key={feature.id}
            className="space-y-2 rounded-lg border p-3 text-sm"
          >
            <h3 className="font-medium">
              {feature.label} · {feature.subjectLabel}
            </h3>
            <p>
              {feature.sceneIds.length} mapped scenes · {feature.assets.length}{" "}
              supplied artifacts
            </p>
            <div className="flex flex-wrap gap-2">
              {feature.assets.length ? (
                feature.assets.map((artifact) => (
                  <Button
                    key={artifact.assetId}
                    size="sm"
                    variant="outline"
                    disabled={pending || !query.data}
                    onClick={() => {
                      if (query.data)
                        void action({
                          action: "preview",
                          expectedHash: query.data.sourceHash,
                          featureId: feature.id,
                          assetId: artifact.assetId,
                        });
                    }}
                  >
                    Preview {name(artifact.assetId)}
                    {artifact.startSeconds
                      ? ` from ${artifact.startSeconds}s`
                      : ""}
                  </Button>
                ))
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || !query.data}
                  onClick={() => {
                    if (query.data)
                      void action({
                        action: "preview",
                        expectedHash: query.data.sourceHash,
                        featureId: feature.id,
                      });
                  }}
                >
                  Preview missing-proof fallback
                </Button>
              )}
            </div>
            <details>
              <summary className="cursor-pointer">
                Replace mapped artifact
              </summary>
              <p className="text-muted-foreground my-2 text-xs">
                Save the replacement, then preview and apply. Scene copy and
                narration are retained.
              </p>
              <ProofReplacement
                feature={feature}
                media={media}
                pending={pending}
                onSave={(artifact) => {
                  if (query.data)
                    void action({
                      action: "save",
                      expectedHash: query.data.sourceHash,
                      features: featureInputs.map((item) =>
                        item.id === feature.id
                          ? { ...item, assets: [artifact] }
                          : item,
                      ),
                    });
                }}
              />
            </details>
          </article>
        ))}
        {preview && (
          <section
            aria-label="Product proof diff"
            className="space-y-2 rounded-lg border p-3 text-sm"
          >
            <h3 className="font-medium">Review the visual replacement</h3>
            {preview.changes.map((change) => (
              <div key={change.sceneId} className="rounded border p-2">
                <p>Copy retained: {change.text}</p>
                <p>Narration retained: {change.narration}</p>
                <p>
                  Before:{" "}
                  {change.beforeAssetIds.map(name).join(", ") ||
                    "Existing visual"}{" "}
                  → After:{" "}
                  {change.afterAssetIds.map(name).join(", ") || "Typography"}
                </p>
                <p>{change.reason}</p>
              </div>
            ))}
            {preview.warnings.map((warning) => (
              <p key={warning}>Review: {warning}</p>
            ))}
            <p>
              Supplied media uses the contained product frame and its brief
              reveal, then holds for the scene&apos;s saved timing. Undo is
              available in saved edit history.
            </p>
            <Button
              disabled={pending}
              onClick={() =>
                void action({
                  action: "apply",
                  expectedHash: preview.sourceHash,
                  featureId: preview.featureId,
                  assetId: preview.assetId,
                })
              }
            >
              Apply proof without rewriting copy
            </Button>
          </section>
        )}
      </div>
    </details>
  );
}

function ProofReplacement({
  feature,
  media,
  pending,
  onSave,
}: {
  feature: ProductProof["features"][number];
  media: AssetDTO[];
  pending: boolean;
  onSave: (artifact: { assetId: string; startSeconds: number }) => void;
}) {
  const [assetId, setAsset] = useState(""),
    [startSeconds, setStart] = useState(0);
  return (
    <fieldset disabled={pending} className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 text-sm">
        Replacement
        <select
          aria-label={`Replacement proof for ${feature.label}`}
          className="bg-background mt-1 block max-w-full rounded border p-2"
          value={assetId}
          onChange={(event) => {
            setAsset(event.target.value);
            setStart(0);
          }}
        >
          <option value="">Choose a supplied replacement</option>
          {media.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.type} · {asset.name ?? "Unnamed artifact"}
            </option>
          ))}
        </select>
      </label>
      {media.find((asset) => asset.id === assetId)?.type === "video" && (
        <label className="text-sm">
          Recording start
          <Input
            type="number"
            min={0}
            max={3600}
            step={0.1}
            aria-label={`Replacement recording start for ${feature.label}`}
            value={startSeconds}
            onChange={(event) => setStart(Number(event.target.value))}
          />
        </label>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !assetId}
        onClick={() => onSave({ assetId, startSeconds })}
      >
        Save replacement mapping
      </Button>
    </fieldset>
  );
}
