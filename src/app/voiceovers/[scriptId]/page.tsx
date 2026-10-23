import { VoiceoverWorkspace } from "@/components/studio/voiceover-workspace";
export default async function VoiceoverPage({
  params,
}: {
  params: Promise<{ scriptId: string }>;
}) {
  const { scriptId } = await params;
  return <VoiceoverWorkspace scriptId={scriptId} />;
}
