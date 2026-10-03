import { ProductionResult } from "@/components/production/production-result";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductionResult jobId={id} />;
}
