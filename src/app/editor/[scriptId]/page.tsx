"use client";

import { use } from "react";

import { EditorClient } from "@/components/editor/editor-client";

export default function EditorScriptPage({
  params,
}: {
  params: Promise<{ scriptId: string }>;
}) {
  const { scriptId } = use(params);
  return <EditorClient scriptId={scriptId} />;
}
