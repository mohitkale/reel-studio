-- Reconciliation looks up render projections without scanning every immutable job snapshot.
CREATE INDEX "ProductionJob_renderId_idx" ON "ProductionJob" (json_extract("inputSnapshot", '$.renderId')) WHERE json_valid("inputSnapshot");
