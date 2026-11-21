"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { ExampleSummary } from "@/library/examples";
import { apiGet } from "@/lib/api-client";

const mediaBase =
  "https://github.com/mohitkale/reel-studio/releases/download/demo-assets";
const featured = ["listicle", "how-to", "explainer"];

export function ExamplePreview({
  name,
  title,
}: Pick<ExampleSummary, "name" | "title">) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setAutoPlay(!motion.matches);
    updateMotion();
    motion.addEventListener("change", updateMotion);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", updateMotion);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="bg-muted flex aspect-video items-center justify-center overflow-hidden rounded-lg"
    >
      {visible && !failed ? (
        <video
          aria-label={`${title} preview`}
          className="size-full object-contain"
          src={`${mediaBase}/gallery-${name}.mp4`}
          poster={`${mediaBase}/gallery-${name}.jpg`}
          muted
          loop
          playsInline
          autoPlay={autoPlay}
          controls
          preload="none"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-muted-foreground px-3 text-center text-xs">
          {failed ? "Preview unavailable" : "Video preview"}
        </span>
      )}
    </div>
  );
}

export function ExamplesStrip() {
  const examples = useQuery({
    queryKey: ["examples"],
    queryFn: () =>
      apiGet<{ examples: ExampleSummary[] }>("/api/examples").then(
        ({ examples }) => examples,
      ),
    staleTime: 5 * 60_000,
  });
  const picks = featured.flatMap((name) =>
    (examples.data ?? []).filter((item) => item.name === name),
  );

  return (
    <section className="space-y-3" aria-labelledby="featured-examples">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="featured-examples" className="font-semibold">
          Start from an example
        </h2>
        <Link href="/examples" className="text-sm underline">
          Browse all examples
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {picks.map((example) => (
          <li key={example.name} className="space-y-2 rounded-lg border p-3">
            <ExamplePreview name={example.name} title={example.title} />
            <Link
              href={`/examples?example=${example.name}#example-${example.name}`}
              className="inline-block text-sm font-medium underline"
            >
              {example.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
