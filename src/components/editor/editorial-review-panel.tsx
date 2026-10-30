"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import type { ScriptDTO, SceneDTO } from "@/lib/dto";
import type {
  EditorialFinding,
  EditorialProposal,
  EditorialReviewControl,
} from "@/production/editorial-review";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { MOTION_RECIPES } from "@/production/motion";
import { useAssets } from "@/hooks/assets";
type Review = {
  sourceHash: string;
  proposal?: EditorialProposal;
  findings: EditorialFinding[];
};
export function EditorialReviewPanel({
  script,
  onSelect,
}: {
  script: ScriptDTO;
  onSelect: (id: string) => void;
}) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["editorial-review", script.id],
    queryFn: () => apiGet<Review>(`/api/scripts/${script.id}/editorial/review`),
    refetchInterval: (q) =>
      pending || q.state.data?.proposal?.state === "running" ? 1000 : false,
  });
  useEffect(() => {
    void client.invalidateQueries({
      queryKey: ["editorial-review", script.id],
    });
  }, [client, script]);

  const [sceneId, setSceneId] = useState(script.scenes[0]?.id ?? "");
  const selected =
    script.scenes.find((s) => s.id === sceneId) ?? script.scenes[0];
  async function action(input: EditorialReviewControl) {
    setPending(true);
    setError("");
    try {
      await apiPost(`/api/scripts/${script.id}/editorial/review`, input);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["editorial-review", script.id] }),
        client.invalidateQueries({ queryKey: ["editorial", script.id] }),
        client.invalidateQueries({ queryKey: ["script", script.id] }),
      ]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Revision failed");
      await client.invalidateQueries({
        queryKey: ["editorial-review", script.id],
      });
    } finally {
      setPending(false);
    }
  }
  const proposal = query.data?.proposal;
  if (!script.scenes.length) return null;
  return (
    <details
      className="bg-card rounded-xl border p-4"
      open={Boolean(script.editorialWorkflow)}
    >
      <summary className="cursor-pointer font-semibold">
        Editorial review and targeted revisions
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted-foreground text-sm">
          Review the contact sheet and animatic below. Findings are conservative
          heuristics; references identify provenance and still need review.
        </p>
        {(error || query.error) && (
          <p role="alert">{error || query.error?.message}</p>
        )}
        {query.data?.findings.map((finding, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span>
              {finding.kind}: {finding.message}
            </span>
            {finding.sceneId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSceneId(finding.sceneId!);
                  onSelect(finding.sceneId!);
                }}
              >
                Review scene
              </Button>
            )}
          </div>
        ))}
        <label className="block text-sm">
          Revision scope
          <select
            aria-label="Editorial revision scene"
            className="bg-background ml-2 rounded border p-2"
            value={selected?.id ?? ""}
            onChange={(e) => setSceneId(e.target.value)}
          >
            {script.scenes.map((s, index) => (
              <option value={s.id} key={s.id}>
                {index + 1}. {s.text.slice(0, 55)}
              </option>
            ))}
          </select>
        </label>
        {selected && query.data && (
          <RevisionForm
            key={`${selected.id}:${query.data.sourceHash}`}
            scene={selected}
            sourceHash={query.data.sourceHash}
            onPreview={(input) => void action(input)}
            pending={pending || proposal?.state === "running"}
            availableCalls={
              script.editorialWorkflow
                ? script.editorialWorkflow.request.budget.maxProviderCalls -
                  script.editorialWorkflow.callsUsed -
                  script.editorialWorkflow.revisionCallsUsed
                : 0
            }
          />
        )}
        {proposal && (
          <section
            aria-label="Revision diff"
            className="space-y-2 rounded-lg border p-3"
          >
            <p role="status">
              {proposal.kind} · {proposal.state} · {proposal.providerCalls}{" "}
              reserved provider calls
            </p>
            {proposal.error && <p role="alert">{proposal.error}</p>}
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <h4 className="font-medium">Before</h4>
                <p>Screen: {proposal.before.text}</p>
                <p>
                  Narration:{" "}
                  {proposal.before.spokenText ?? proposal.before.text}
                </p>
                <p>Visual: {visualDescription(proposal.before)}</p>
              </div>
              <div>
                <h4 className="font-medium">After</h4>
                <p>Screen: {proposal.after.text}</p>
                <p>
                  Narration: {proposal.after.spokenText ?? proposal.after.text}
                </p>
                <p>Visual: {visualDescription(proposal.after)}</p>
              </div>
            </div>
            {proposal.before.layoutJson !== proposal.after.layoutJson && (
              <p className="text-sm">
                Visual treatment changes. Copy and narration are preserved for
                visual revisions.
              </p>
            )}
            <div className="flex gap-2">
              {proposal.state === "ready" && (
                <Button
                  disabled={pending}
                  onClick={() =>
                    void action({
                      action: "apply",
                      proposalId: proposal.id,
                      expectedHash: proposal.sourceHash,
                    })
                  }
                >
                  Apply scoped revision
                </Button>
              )}
              {proposal.state === "applied" && proposal.appliedHash && (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    void action({
                      action: "undo",
                      proposalId: proposal.id,
                      expectedHash: proposal.appliedHash!,
                    })
                  }
                >
                  Undo scoped revision
                </Button>
              )}
              {["running", "ready"].includes(proposal.state) && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void action({
                      action: "cancel",
                      proposalId: proposal.id,
                      expectedHash: proposal.sourceHash,
                    })
                  }
                >
                  Cancel revision
                </Button>
              )}
            </div>
          </section>
        )}
      </div>
    </details>
  );
}
function RevisionForm({
  scene,
  sourceHash,
  pending,
  availableCalls,
  onPreview,
}: {
  scene: SceneDTO;
  sourceHash: string;
  pending: boolean;
  availableCalls: number;
  onPreview: (
    input: Extract<EditorialReviewControl, { action: "preview" }>,
  ) => void;
}) {
  const [kind, setKind] = useState<EditorialProposal["kind"]>("make-specific");
  const [detail, setDetail] = useState(""),
    [screenCopy, setScreen] = useState(scene.text),
    [narration, setNarration] = useState(scene.spokenText ?? scene.text),
    [assetId, setAssetId] = useState(""),
    [useWriter, setUseWriter] = useState(false);
  const { data: assets = [] } = useAssets("image");
  const copy = kind === "make-specific" || kind === "shorten";
  const locked =
    scene.locks?.scene || (copy ? scene.locks?.copy : scene.locks?.assets);
  return (
    <fieldset disabled={pending} className="space-y-2 rounded-lg border p-3">
      <label className="block text-sm">
        Action
        <select
          aria-label="Editorial revision action"
          className="bg-background ml-2 rounded border p-2"
          value={kind}
          onChange={(e) => setKind(e.target.value as EditorialProposal["kind"])}
        >
          <option value="make-specific">Make specific</option>
          <option value="shorten">Shorten</option>
          <option value="replace-visual">Replace visual</option>
          <option value="change-direction">Keep copy / change direction</option>
        </select>
      </label>
      {locked && (
        <p>This scope is protected. Unlock it in the scene editor first.</p>
      )}
      {copy && (
        <>
          <label className="block text-sm">
            Supplied concrete detail
            <Textarea
              aria-label="Editorial supplied detail"
              value={detail}
              maxLength={4000}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useWriter}
              disabled={availableCalls < 1}
              onChange={(e) => setUseWriter(e.target.checked)}
            />
            Use saved writer for one explicit call ({availableCalls} remaining).
            Research and other writing are reused.
          </label>
          {!useWriter && (
            <>
              <label className="block text-sm">
                Replacement screen copy
                <Textarea
                  aria-label="Editorial replacement screen copy"
                  value={screenCopy}
                  maxLength={1000}
                  onChange={(e) => setScreen(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Replacement narration
                <Textarea
                  aria-label="Editorial replacement narration"
                  value={narration}
                  maxLength={4000}
                  onChange={(e) => setNarration(e.target.value)}
                />
              </label>
            </>
          )}
        </>
      )}
      {kind === "replace-visual" && (
        <label className="block text-sm">
          Replacement
          <select
            aria-label="Editorial replacement asset"
            className="bg-background ml-2 rounded border p-2"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          >
            <option value="">Plain typography</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name ?? asset.id}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        variant="outline"
        disabled={
          pending || locked || (kind === "make-specific" && !detail.trim())
        }
        onClick={() =>
          onPreview({
            action: "preview",
            key: `revision:${crypto.randomUUID()}`,
            expectedHash: sourceHash,
            sceneId: scene.id,
            kind,
            detail,
            ...(copy && !useWriter ? { copy: { screenCopy, narration } } : {}),
            ...(kind === "replace-visual" && assetId ? { assetId } : {}),
            budget: { maxProviderCalls: copy && useWriter ? 1 : 0 },
          })
        }
      >
        Preview scoped revision
      </Button>
    </fieldset>
  );
}

const visualConfig = z.object({
  motion: z.object({ recipeId: z.string() }).optional(),
  background: z.object({ url: z.string() }).optional(),
});
function visualDescription(scene: EditorialProposal["before"]) {
  let recipe: string | undefined;
  try {
    const parsed = visualConfig.safeParse(JSON.parse(scene.layoutJson ?? "{}"));
    if (parsed.success) recipe = parsed.data.motion?.recipeId;
  } catch {
    /* The saved renderer remains authoritative for legacy content. */
  }
  const name =
    MOTION_RECIPES.find((item) => item.id === recipe)?.name ?? "Preset look";
  const template: Record<string, string> = {
    "hf-statement": "Typography",
    "hf-broll": "Supplied image",
    "hf-stat": "Metric layout",
    "hf-data-chart": "Data chart",
    "hf-opener": "Opening title",
  };
  return `${template[scene.templateId] ?? "Saved template"} · ${name}`;
}
