import { ExamplesGallery } from "@/components/studio/examples-gallery";
import { listExamples } from "@/library/examples";

export default async function ExamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ example?: string | string[] }>;
}) {
  const { example } = await searchParams;
  const examples = listExamples();
  const initialOpen = examples.find((item) => item.name === example)?.name;
  return (
    <ExamplesGallery
      key={initialOpen}
      examples={examples}
      initialOpen={initialOpen}
    />
  );
}
