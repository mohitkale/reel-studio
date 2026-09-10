# Dependency decisions

The frozen registry inventory is in `dependencies.json`. Install targets exclude prereleases, even when a publisher uses the latest tag for one.

- Runtime: Node 24 LTS (minimum 24.15), matching modern test tooling requirements. Node types use the 24 line instead of the registry latest tag's 22 line.
- React / React DOM: 19.2.8. Stable 19.3.0 is excluded because even React Three Fiber 9.7.0 declares `>=19 <19.3`. Preserve Three.js support; do not override its peer contract.
- Prisma: 7.10.0. The registry latest tag points to 8.0.0-rc.13, which is explicitly excluded.
- HyperFrames: producer 0.8.33 and CLI 0.8.27 are the compatible published targets. GSAP 3.14.2 is pinned and copied into each render workspace so frame capture does not fetch its motion runtime from the network.
- Remotion family: all direct packages target exactly 4.0.523.

## Baseline render finding

Both engines encoded three-second H.264 fixtures before upgrades. HyperFrames at 0.7.61 produced a background-only sampled frame; this is an existing visual failure, not an accepted baseline. The HyperFrames compatibility task must fix it before the first milestone passes.

HyperFrames 0.8.33 now receives a direct composition root, canonical clip IDs, and a root timeline under the composition ID. The regression harness rejects background-only frames, and the 0.8.27 checker reports no lint, runtime, layout, motion, or contrast findings for the generated fixture.

- Production builds explicitly use Next's supported Webpack path. Turbopack failed to launch its CSS evaluation subprocess in the validation environment, including an escalated retry. Webpack completes the same application compilation and type checks. Geist fonts are packaged locally so builds do not need Google Fonts.
