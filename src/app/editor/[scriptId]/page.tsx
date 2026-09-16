"use client";

import { use } from "react";

import { EditorClient } from "@/components/editor/editor-client";

export default function EditorScriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ scriptId: string }>;
  searchParams: Promise<{ productionJob?: string | string[] }>;
}) {
  const { scriptId } = use(params);
  const query = use(searchParams);
  const productionJobId = Array.isArray(query.productionJob)
    ? query.productionJob[0]
    : query.productionJob;
  return (
    <EditorClient
      scriptId={scriptId}
      productionJobId={productionJobId ?? null}
    />
  );
}
