"use client";

import Link from "next/link";
import { Activity, Film, Headphones, Sparkles } from "lucide-react";

import { CreationWizard } from "@/components/projects/creation-wizard";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PRODUCTION_PRESETS } from "@/production/presets";

const VIDEO_SAMPLES = [
  {
    id: "portrait",
    title: "Creator reel",
    ratio: "9:16 portrait",
    video: "/media/gallery/portrait-demo.mp4",
    poster: "/media/gallery/portrait-demo.jpg",
  },
  {
    id: "landscape",
    title: "Product walkthrough",
    ratio: "16:9 landscape",
    video: "/media/gallery/landscape-demo.mp4",
    poster: "/media/gallery/landscape-demo.jpg",
  },
  {
    id: "square",
    title: "Social explainer",
    ratio: "1:1 square",
    video: "/media/gallery/square-demo.mp4",
    poster: "/media/gallery/square-demo.jpg",
  },
] as const;

export default function GalleryPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Production gallery"
        description="Outputs made by the shipped local engines, with presets you can start using immediately."
        actions={
          <Button asChild variant="outline">
            <Link href="/diagnostics">
              <Activity /> Check setup
            </Link>
          </Button>
        }
      />

      <section className="space-y-4" aria-labelledby="gallery-video-heading">
        <div className="space-y-1">
          <h3 id="gallery-video-heading" className="text-lg font-semibold">
            Reproducible local outputs
          </h3>
          <p className="text-muted-foreground text-sm">
            These bundled examples cover all three production ratios. Rendering
            never needs a cloud key.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {VIDEO_SAMPLES.map((sample) => (
            <Card key={sample.id} className="overflow-hidden">
              <div className="bg-muted">
                <video
                  controls
                  preload="metadata"
                  poster={sample.poster}
                  className="aspect-video w-full object-contain"
                >
                  <source src={sample.video} type="video/mp4" />
                </video>
              </div>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{sample.title}</CardTitle>
                  <Badge variant="secondary">{sample.ratio}</Badge>
                </div>
                <CardDescription>
                  Independently composed for this canvas instead of cropping a
                  completed video.
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Headphones className="text-primary size-5" />
                <CardTitle>Podcast master</CardTitle>
              </div>
              <CardDescription>
                A locally produced multi-speaker sample with reusable turn
                audio.
              </CardDescription>
            </div>
            <audio controls preload="metadata" className="w-full sm:w-80">
              <source src="/media/gallery/podcast-demo.mp3" type="audio/mpeg" />
            </audio>
          </CardHeader>
        </Card>
      </section>

      <section className="space-y-4" aria-labelledby="gallery-preset-heading">
        <div className="space-y-1">
          <h3 id="gallery-preset-heading" className="text-lg font-semibold">
            Six production-ready starting points
          </h3>
          <p className="text-muted-foreground text-sm">
            Each preset defines scene roles, pacing, typography, captions,
            transitions, music mood, and sound intensity for both engines.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PRODUCTION_PRESETS.map((preset) => (
            <Card key={preset.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {preset.id === "developer-demo" ? (
                      <Film className="text-primary size-5" />
                    ) : (
                      <Sparkles className="text-primary size-5" />
                    )}
                    <CardTitle>{preset.name}</CardTitle>
                  </div>
                  <Badge variant="outline">v{preset.version}</Badge>
                </div>
                <CardDescription>{preset.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-wrap content-start gap-1.5">
                {preset.sceneRoles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role.replaceAll("-", " ")}
                  </Badge>
                ))}
              </CardContent>
              <CardFooter>
                <CreationWizard
                  initialPresetId={preset.id}
                  trigger={<Button className="w-full">Use this preset</Button>}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
