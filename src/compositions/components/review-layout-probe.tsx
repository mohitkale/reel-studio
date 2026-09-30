import { useEffect, useState } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";
import type { ProductionLayout } from "@/production/layout";
import {
  LAYOUT_LOG_PREFIX,
  measureReviewLayout,
} from "@/production/visual-review-layout";

/** Mounted only by native still review, never by preview or export. */
export function ReviewLayoutProbe({ layout }: { layout: ProductionLayout }) {
  const frame = useCurrentFrame();
  return <FrameProbe key={frame} layout={layout} frame={frame} />;
}

function FrameProbe({
  layout,
  frame,
}: {
  layout: ProductionLayout;
  frame: number;
}) {
  const [handle] = useState(() => delayRender("Measuring review text layout"));
  useEffect(() => {
    let active = true;
    void document.fonts.ready
      .then(() => {
        if (!active) return;
        try {
          const root =
            document.querySelector<HTMLElement>("[data-review-root]");
          if (root)
            console.log(
              LAYOUT_LOG_PREFIX +
                JSON.stringify(measureReviewLayout(root, layout, frame)),
            );
        } finally {
          continueRender(handle);
        }
      })
      .catch(() => {
        // Capture rejects absent evidence instead of hanging on a font/measurement failure.
        continueRender(handle);
      });
    return () => {
      active = false;
      continueRender(handle);
    };
  }, [frame, handle, layout]);
  return null;
}
