"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  factoryProfileDocumentSchema,
  type FactoryVariant,
} from "@/production/factory";
import type { Orientation } from "@/lib/orientation";
import type { VideoSnapshot } from "@/production/video-snapshot";
import type { FilmPlanDocument } from "@/production/film-plan-document";
import type { listFactoryRuns } from "@/library/factory-service";
type Run = Awaited<ReturnType<typeof listFactoryRuns>>[number];
type Data = {
  profiles: Array<{
    id: string;
    name: string;
    key: string;
    version: number;
    documentJson: string;
  }>;
  runs: Run[];
  packs: Array<{ digest: string; key: string; version: string }>;
  revisions: Array<{
    id: string;
    scriptId: string;
    source: string;
    script: { name: string };
  }>;
};
const formats: Orientation[] = ["portrait", "landscape", "square"];
export function FactoryPanel({
  scriptId,
  voiceTakeId,
}: {
  scriptId?: string;
  voiceTakeId?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient(),
    query = useQuery({
      queryKey: ["factory"],
      queryFn: () => apiGet<Data>("/api/factory"),
      refetchInterval: 5000,
    });
  const [master, setMaster] = React.useState(""),
    [profile, setProfile] = React.useState(""),
    [selected, setSelected] = React.useState<Orientation[]>([
      "portrait",
      "landscape",
      "square",
    ]),
    [quality, setQuality] = React.useState("draft");
  const [name, setName] = React.useState(""),
    [key, setKey] = React.useState(""),
    [version, setVersion] = React.useState(1);
  const [cut, setCut] = React.useState(false),
    [start, setStart] = React.useState(1),
    [end, setEnd] = React.useState(1),
    [cutFormat, setCutFormat] = React.useState<Orientation>("portrait");
  const [mode, setMode] = React.useState<"automatic" | "approval">("approval"),
    [error, setError] = React.useState("");
  const submission = React.useRef<{ json: string; key: string } | null>(null);
  const source = useQuery({
    queryKey: ["factory-revision", master],
    queryFn: () =>
      apiGet<{ document: { snapshot: VideoSnapshot } }>(
        `/api/factory/revisions/${encodeURIComponent(master)}`,
      ),
    enabled: Boolean(master),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["factory"] });
  const action = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => {
      setError("");
      return run();
    },
    onError: (error: Error) => setError(error.message),
    onSuccess: refresh,
  });
  function freeze() {
    if (!scriptId) return;
    action.mutate(async () => {
      const document = await apiGet<FilmPlanDocument>(
        `/api/scripts/${encodeURIComponent(scriptId)}/film-plan${voiceTakeId ? `?voiceTakeId=${encodeURIComponent(voiceTakeId)}` : ""}`,
      );
      const saved = await apiPost<{ revisionId: string }>(
        `/api/scripts/${encodeURIComponent(scriptId)}/film-plan`,
        { document },
      );
      setMaster(saved.revisionId);
    });
  }
  const snapshot = source.data?.document.snapshot,
    scenes = snapshot?.script.scenes ?? [];
  function submit() {
    const variants: FactoryVariant[] = selected.map((orientation) => ({
      key: `story-${orientation}`,
      label: `Full story · ${orientation}`,
      kind: "aspect",
      orientation,
    }));
    if (cut)
      variants.push({
        key: "cutdown",
        label: "Selected scene cutdown",
        kind: "cutdown",
        orientation: cutFormat,
        sceneIds: scenes.slice(start - 1, end).map((scene) => scene.id),
      });
    const body = {
        sourceRevisionId: master,
        profileId: profile || undefined,
        variants,
        quality,
        runMode: mode,
      },
      json = JSON.stringify(body);
    if (submission.current?.json !== json)
      submission.current = { json, key: crypto.randomUUID() };
    const idempotencyKey = submission.current!.key;
    action.mutate(async () => {
      const result = await apiPost("/api/factory/runs", {
        ...body,
        idempotencyKey,
      });
      submission.current = null;
      return result;
    });
  }
  const busy = action.isPending;
  return (
    <section
      aria-label="Content factory"
      className="bg-card space-y-4 rounded-xl border p-4"
    >
      <div>
        <h2 className="text-base font-semibold">Content factory</h2>
        <p className="text-muted-foreground text-xs">
          Reuse a series design and make versions from a saved master. Full
          story formats preserve copy; cutdowns select complete scenes. No AI or
          voice generation is triggered.
        </p>
      </div>
      {scriptId && (
        <Button variant="outline" disabled={busy} onClick={freeze}>
          Freeze current film as master
        </Button>
      )}
      <label className="grid gap-1 text-xs">
        Saved master
        <select
          aria-label="Factory master"
          className="bg-background rounded border p-2"
          value={master}
          onChange={(e) => {
            setMaster(e.target.value);
            setStart(1);
            setEnd(1);
          }}
        >
          <option value="">Choose a frozen revision</option>
          {query.data?.revisions.map((revision) => (
            <option key={revision.id} value={revision.id}>
              {revision.script.name} · {revision.source} ·{" "}
              {revision.id.slice(-6)}
            </option>
          ))}
        </select>
      </label>
      {snapshot && (
        <p className="text-muted-foreground text-xs">
          {scenes.length} source scenes ·{" "}
          {snapshot.take
            ? "Saved narration timing"
            : "Estimated timing, no narration"}
          . Master edits after capture do not change this revision.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">
          Series profile
          <select
            aria-label="Factory series profile"
            className="bg-background rounded border p-2"
            value={profile}
            onChange={(e) => {
              setProfile(e.target.value);
              const row = query.data?.profiles.find(
                (p) => p.id === e.target.value,
              );
              if (row) {
                const document = factoryProfileDocumentSchema.parse(
                  JSON.parse(row.documentJson),
                );
                setSelected(document.orientations);
                setQuality(document.quality);
              }
            }}
          >
            <option value="">Keep the master design</option>
            {query.data?.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · v{p.version}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Quality
          <select
            aria-label="Factory quality"
            className="bg-background rounded border p-2"
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
          >
            {["draft", "standard", "high"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-2 text-xs font-medium">Full story formats</legend>
        {formats.map((format) => (
          <label key={format} className="flex gap-2 text-xs">
            <input
              type="checkbox"
              checked={selected.includes(format)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, format]
                    : selected.filter((v) => v !== format),
                )
              }
            />
            {format}
          </label>
        ))}
      </fieldset>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={cut}
          onChange={(e) => setCut(e.target.checked)}
        />
        Add a cutdown from selected scenes
      </label>
      {cut && (
        <div className="grid gap-2 rounded border p-3">
          <p className="text-muted-foreground text-xs">
            Select 1–20 complete scenes in source order, up to three minutes. A
            measured take must use local normalized WAV audio. Caption cues
            crossing removed passages must be split first.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 text-xs">
              First scene
              <Input
                aria-label="Cutdown first scene"
                type="number"
                min={1}
                max={scenes.length}
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1 text-xs">
              Last scene
              <Input
                aria-label="Cutdown last scene"
                type="number"
                min={start}
                max={Math.min(scenes.length, start + 19)}
                value={end}
                onChange={(e) => setEnd(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1 text-xs">
              Format
              <select
                aria-label="Cutdown format"
                className="bg-background rounded border p-2"
                value={cutFormat}
                onChange={(e) => setCutFormat(e.target.value as Orientation)}
              >
                {formats.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex gap-2 text-xs">
          <input
            type="checkbox"
            checked={mode === "approval"}
            onChange={(e) =>
              setMode(e.target.checked ? "approval" : "automatic")
            }
          />
          Review before rendering
        </label>
        <Button
          disabled={
            busy ||
            !snapshot ||
            (!selected.length && !cut) ||
            (cut &&
              (start < 1 ||
                end < start ||
                end > scenes.length ||
                end - start >= 20 ||
                end - start + 1 === scenes.length))
          }
          onClick={submit}
        >
          {busy ? "Saving…" : "Create factory run"}
        </Button>
      </div>
      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm">
          Save a reusable series profile
        </summary>
        <p className="text-muted-foreground mt-2 text-xs">
          Capture this master’s brand and design with the selected full story
          formats and quality. Existing versions remain immutable. Publish the
          next version to change defaults.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Input
            aria-label="Series name"
            placeholder="Series name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            aria-label="Series key"
            placeholder="series-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <Input
            aria-label="Series version"
            type="number"
            min={1}
            max={20}
            value={version}
            onChange={(e) => setVersion(Number(e.target.value))}
          />
        </div>
        <Button
          className="mt-2"
          variant="outline"
          disabled={busy || !master || !name || !key || !selected.length}
          onClick={() =>
            action.mutate(() =>
              apiPost("/api/factory/profiles", {
                key,
                version,
                name,
                sourceRevisionId: master,
                orientations: selected,
                quality,
              }),
            )
          }
        >
          Save profile version
        </Button>
        <div className="mt-3 space-y-1">
          {query.data?.profiles.map((p) => (
            <p key={p.id} className="flex items-center justify-between text-xs">
              {p.name} · v{p.version}
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  action.mutate(() =>
                    apiDelete(`/api/factory/profiles/${p.id}`),
                  )
                }
              >
                Archive profile
              </Button>
            </p>
          ))}
        </div>
      </details>
      {(error || query.error || source.error) && (
        <p role="alert" className="text-destructive text-sm">
          {error || query.error?.message || source.error?.message}
        </p>
      )}
      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm">
          Pinned recipe packs
        </summary>
        <p className="text-muted-foreground my-2 text-xs">
          Bundled Adaptive Core is pinned when saving a profile or submitting a
          run. Archives include local runtime assets, fonts, recipe manifests,
          checksums and license notices. Pack downloads are data archives; the
          app does not install executable uploads.
        </p>
        {query.data?.packs.map((pack) => (
          <p key={pack.digest} className="text-xs">
            <a
              className="underline"
              href={`/api/factory/packs/${encodeURIComponent(pack.digest)}`}
            >
              Download {pack.key} · {pack.version}
            </a>
          </p>
        ))}
      </details>
      <div className="space-y-3">
        {query.data?.runs.map((run) => (
          <article key={run.id} className="space-y-2 rounded border p-3">
            <p className="text-sm font-medium">
              Factory run ·{" "}
              {run.batch?.state.replaceAll("_", " ") ?? "submission incomplete"}{" "}
              · {run.variants.length} variants
            </p>
            <div className="flex flex-wrap gap-2">
              {run.variants.map((variant) => (
                <a
                  key={variant.id}
                  className="text-xs underline"
                  href={`/api/factory/revisions/${variant.revisionId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {variant.key} · frozen plan
                </a>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {run.batch?.items.map((item) =>
                item.job?.state === "succeeded" && item.job.revision ? (
                  <Button
                    key={item.id}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      action.mutate(async () => {
                        const restored = await apiPost<{ scriptId: string }>(
                          `/api/production-jobs/${item.job!.id}/revision`,
                          {},
                        );
                        router.push(`/editor/${restored.scriptId}`);
                      })
                    }
                  >
                    Edit copy · {item.label ?? item.orientation}
                  </Button>
                ) : null,
              )}
            </div>
            <details className="text-xs">
              <summary>Versions and source</summary>
              <p>Parent revision: {run.sourceRevisionId}</p>
              <p className="break-all">Pack: {run.packDigest}</p>
            </details>
            <div className="flex flex-wrap gap-2">
              {(["cancel", "resume", "approve"] as const).map((value) => (
                <Button
                  size="sm"
                  variant="outline"
                  key={value}
                  disabled={
                    busy ||
                    (value === "approve" &&
                      run.batch?.state !== "awaiting_approval") ||
                    (value === "cancel" &&
                      ["succeeded", "canceled"].includes(
                        run.batch?.state ?? "",
                      )) ||
                    (value === "resume" && run.batch?.state === "succeeded")
                  }
                  onClick={() =>
                    action.mutate(() =>
                      apiPost(`/api/factory/runs/${run.id}`, { action: value }),
                    )
                  }
                >
                  {value === "resume"
                    ? "Resume incomplete"
                    : value === "approve"
                      ? "Approve run"
                      : "Cancel run"}
                </Button>
              ))}
              {run.batch && (
                <a
                  href={run.batch.bundleUrl}
                  className="self-center text-xs underline"
                >
                  Download completed outputs
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
