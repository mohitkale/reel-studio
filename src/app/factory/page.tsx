import Link from "next/link";
import { FactoryPanel } from "@/components/production/factory-panel";
import { ProductionBatchList } from "@/components/production/production-batch-list";
import { ProductionJobList } from "@/components/production/production-job-list";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
export default function FactoryPage() {
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Content factory"
        description="Freeze a master, review derived outputs, and produce a consistent series."
        actions={
          <Button asChild variant="outline">
            <Link href="/renders">Finished exports</Link>
          </Button>
        }
      />
      <ol
        className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"
        aria-label="Factory workflow"
      >
        {[
          "1. Save a master in the editor",
          "2. Choose formats and cutdowns",
          "3. Review and approve",
          "4. Download the package",
        ].map((step) => (
          <li key={step} className="bg-card rounded-lg border p-3">
            {step}
          </li>
        ))}
      </ol>
      <FactoryPanel />
      <section className="space-y-4" aria-label="Production queue">
        <h2 className="text-lg font-semibold">Queue and review</h2>
        <ProductionBatchList />
        <ProductionJobList />
      </section>
    </div>
  );
}
