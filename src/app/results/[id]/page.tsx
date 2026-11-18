import { ProductionResult } from "@/components/production/production-result";

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  // Only a plain id is passed on; anything else is ignored.
  const previous =
    typeof from === "string" && /^[A-Za-z0-9]{8,40}$/.test(from)
      ? from
      : undefined;
  return <ProductionResult jobId={id} previousJobId={previous} />;
}
