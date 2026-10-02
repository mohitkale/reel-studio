-- Existing project content, narration, media, and renders remain intact.
UPDATE "Project" SET "videoEngine" = 'hyperframes' WHERE "videoEngine" = 'remotion';
UPDATE "Scene" SET "templateId" = CASE "templateId"
 WHEN 'kinetic' THEN 'hf-opener' WHEN 'placeholder' THEN 'hf-opener'
 WHEN 'lottie' THEN 'hf-statement' WHEN 'three' THEN 'hf-statement'
 WHEN 'stat-reveal' THEN 'hf-stat' WHEN 'icon-grid' THEN 'hf-list'
 WHEN 'quote-card' THEN 'hf-quote' WHEN 'emoji-punch' THEN 'hf-opener'
 ELSE "templateId" END
 WHERE "templateId" IN ('kinetic','placeholder','lottie','three','stat-reveal','icon-grid','quote-card','emoji-punch');
