## Look variety, camera and parallax (storyboard videos)

Storyboard videos get a per-scene look from `src/video/variety.ts`: a layout variant
(`panel`, `open`, `band`), an arrangement of the scene type's own content (1 to 3, CSS in
`scenes/arrangements.ts`), an entrance (`rise`, `slide`, `pop`, `drift`) and sometimes a
camera move (`push-in`, `pull-out`, `pan`) on the scene's content with the decorative
background shapes moving against it at their own depth. The plan is deterministic for a
storyboard and seed, `variety` sets how often non-default variants appear, and
`reduceMotion` turns camera moves off and keeps every entrance a plain rise. Scenes can also
carry one of sixty looping background illustrations (`illustration` in the storyboard;
`docs/assets/illustrations/sheet.jpg`, `npm run illustrations:sheet`), drawn by code so there is
no third-party artwork. Not built yet: rack focus, 3D orbit, image saliency and cut-out
parallax.
