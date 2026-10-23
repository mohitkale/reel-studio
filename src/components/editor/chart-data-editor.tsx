"use client";
import { useState } from "react";
import type { SceneChartData } from "@/lib/dto";
import { productionChartDataSchema } from "@/production/spec";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function ChartDataEditor({
  chart,
  onSave,
  onClear,
}: {
  chart?: SceneChartData;
  onSave(chart: SceneChartData): void;
  onClear(): void;
}) {
  const [labels, setLabels] = useState(chart?.labels ?? [""]);
  const [series, setSeries] = useState(
    chart?.series.map((s) => ({ ...s, values: s.values.map(String) })) ?? [
      { label: "", unit: "", values: [""] },
    ],
  );
  const [source, setSource] = useState(chart?.sourceAttribution ?? ""),
    [error, setError] = useState("");
  function save() {
    const result = productionChartDataSchema.safeParse({
      labels: labels.map((l) => l.trim()),
      series: series.map((s) => ({
        ...s,
        label: s.label.trim(),
        values: s.values.map((v) => (v.trim() ? Number(v) : NaN)),
      })),
      sourceAttribution: source,
    });
    if (!result.success) {
      setError(
        "Give every row and series a name and enter a finite number in every cell.",
      );
      return;
    }
    setError("");
    onSave(result.data);
  }
  return (
    <div className="min-w-0 space-y-3">
      <p className="text-muted-foreground text-xs">
        Enter supplied values, including negative values. Complex charts may
        require a different visual treatment; review the preview after saving.
      </p>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Chart labels and series values</caption>
          <thead>
            <tr>
              <th scope="col">Label</th>
              {series.map((s, i) => (
                <th key={i} scope="col" className="min-w-28 p-1">
                  <Input
                    aria-label={`Series ${i + 1} name`}
                    maxLength={120}
                    value={s.label}
                    onChange={(e) =>
                      setSeries(
                        series.map((v, n) =>
                          n === i ? { ...v, label: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label={`Series ${i + 1} unit`}
                    placeholder="Unit"
                    maxLength={40}
                    value={s.unit ?? ""}
                    onChange={(e) =>
                      setSeries(
                        series.map((v, n) =>
                          n === i ? { ...v, unit: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={series.length === 1}
                    onClick={() => setSeries(series.filter((_, n) => n !== i))}
                  >
                    Remove series {i + 1}
                  </Button>
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {labels.map((label, row) => (
              <tr key={row}>
                <td className="min-w-28 p-1">
                  <Input
                    aria-label={`Row ${row + 1} label`}
                    maxLength={120}
                    value={label}
                    onChange={(e) =>
                      setLabels(
                        labels.map((v, n) => (n === row ? e.target.value : v)),
                      )
                    }
                  />
                </td>
                {series.map((s, col) => (
                  <td key={col} className="p-1">
                    <Input
                      aria-label={`Row ${row + 1} series ${col + 1} value`}
                      inputMode="decimal"
                      value={s.values[row]}
                      onChange={(e) =>
                        setSeries(
                          series.map((v, n) =>
                            n === col
                              ? {
                                  ...v,
                                  values: v.values.map((value, i) =>
                                    i === row ? e.target.value : value,
                                  ),
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove row ${row + 1}`}
                    disabled={labels.length === 1}
                    onClick={() => {
                      setLabels(labels.filter((_, i) => i !== row));
                      setSeries(
                        series.map((s) => ({
                          ...s,
                          values: s.values.filter((_, i) => i !== row),
                        })),
                      );
                    }}
                  >
                    ×
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={labels.length >= 100}
          onClick={() => {
            setLabels([...labels, ""]);
            setSeries(series.map((s) => ({ ...s, values: [...s.values, ""] })));
          }}
        >
          Add row
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={series.length >= 12}
          onClick={() =>
            setSeries([
              ...series,
              { label: "", unit: "", values: labels.map(() => "") },
            ])
          }
        >
          Add series
        </Button>
      </div>
      <Input
        aria-label="Data source"
        placeholder="Source or attribution"
        maxLength={500}
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save}>
          Save data
        </Button>
        {chart && (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear data
          </Button>
        )}
      </div>
    </div>
  );
}
